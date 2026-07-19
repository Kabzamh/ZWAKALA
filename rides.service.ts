import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from './pricing.service';
import { MatchingService } from './matching.service';
import { PromoService } from '../promo/promo.service';
import { PaymentsService } from '../payments/payments.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { EstimateRideDto } from './dto/estimate.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { CompleteRideDto } from './dto/complete-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';

const ACTIVE_STATUSES = ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] as const;

@Injectable()
export class RidesService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private matching: MatchingService,
    private promo: PromoService,
    private payments: PaymentsService,
    private realtime: RealtimeGateway,
  ) {}

  // ---------- passenger: estimate ----------

  async estimate(dto: EstimateRideDto) {
    const rideTypes = await this.prisma.rideType.findMany({ where: { isActive: true } });
    const route = this.pricing.estimateRoute(dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng);

    return Promise.all(
      rideTypes.map(async (rt) => {
        const fare = this.pricing.calculateFare(rt, route.distanceKm, route.durationMin);
        return {
          rideTypeId: rt.id,
          rideTypeCode: rt.code,
          etaMinutesToPickup: await this.mockEtaToPickup(),
          estimatedFare: fare.subtotal,
          surgeMultiplier: fare.surgeMultiplier,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
        };
      }),
    );
  }

  // A real implementation queries nearby online drivers' locations for this.
  private async mockEtaToPickup() {
    return 3 + Math.floor(Math.random() * 6);
  }

  // ---------- passenger: create / cancel ----------

  async create(passengerId: string, dto: CreateRideDto) {
    const existingActive = await this.prisma.ride.findFirst({
      where: { passengerId, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (existingActive) throw new ConflictException('You already have an active ride');

    const rideType = await this.prisma.rideType.findUnique({ where: { id: dto.rideTypeId } });
    if (!rideType || !rideType.isActive) throw new BadRequestException('Invalid ride type');

    const route = this.pricing.estimateRoute(dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng);
    const fare = this.pricing.calculateFare(rideType, route.distanceKm, route.durationMin);

    let promoDiscount = 0;
    if (dto.promoCode) {
      const validation = await this.promo.validate(dto.promoCode);
      if (!validation.valid) throw new BadRequestException(validation.reason ?? 'Invalid promo code');
      promoDiscount = this.promo.calculateDiscount(fare.subtotal, validation);
    }

    const ride = await this.prisma.ride.create({
      data: {
        passengerId,
        rideTypeId: rideType.id,
        status: 'REQUESTED',
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffAddress: dto.dropoffAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        baseFare: fare.baseFare,
        distanceFare: fare.distanceFare,
        timeFare: fare.timeFare,
        surgeMultiplier: fare.surgeMultiplier,
        promoDiscount,
        totalFare: Number((fare.subtotal - promoDiscount).toFixed(2)),
      },
      include: { rideType: true },
    });

    if (dto.promoCode && promoDiscount > 0) {
      await this.promo.redeem(dto.promoCode, passengerId, ride.id);
    }

    this.matching.dispatch(ride.id);
    return ride;
  }

  async findOne(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { rideType: true, vehicle: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');

    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    const isParty = ride.passengerId === userId || (driverProfile && ride.driverId === driverProfile.id);
    if (!isParty) throw new ForbiddenException('Not a party to this ride');

    return ride;
  }

  async list(passengerId: string, status?: string, page = 1, pageSize = 20) {
    const where = { passengerId, ...(status ? { status: status as any } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        include: { rideType: true, vehicle: true },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ride.count({ where }),
    ]);
    return { items, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async cancel(userId: string, rideId: string, reason?: string) {
    const ride = await this.getRideOr404(rideId);
    if (!(['REQUESTED', 'ACCEPTED', 'ARRIVED'] as string[]).includes(ride.status)) {
      throw new ConflictException('Ride is too far along to cancel');
    }

    const isPassenger = ride.passengerId === userId;
    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    const isDriver = driverProfile && ride.driverId === driverProfile.id;
    if (!isPassenger && !isDriver) throw new ForbiddenException('Not a party to this ride');

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: isPassenger ? 'CANCELLED_BY_PASSENGER' : 'CANCELLED_BY_DRIVER',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    this.realtime.emitToRide(rideId, 'ride.status_changed', { rideId, status: updated.status, timestamp: new Date() });
    return updated;
  }

  // ---------- driver: offer response + trip lifecycle ----------

  async accept(userId: string, rideId: string) {
    const driverProfile = await this.driverProfileOrThrow(userId);
    return this.matching.acceptOffer(rideId, driverProfile.id);
  }

  async decline(userId: string, rideId: string) {
    const driverProfile = await this.driverProfileOrThrow(userId);
    this.matching.declineOffer(rideId, driverProfile.id);
  }

  async markArrived(userId: string, rideId: string) {
    const ride = await this.assertDriverOwnsRide(userId, rideId, ['ACCEPTED']);
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'ARRIVED', arrivedAt: new Date() },
    });
    this.realtime.emitToRide(rideId, 'ride.status_changed', { rideId, status: 'ARRIVED', timestamp: new Date() });
    return updated;
  }

  async start(userId: string, rideId: string) {
    const ride = await this.assertDriverOwnsRide(userId, rideId, ['ARRIVED']);
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    this.realtime.emitToRide(rideId, 'ride.status_changed', { rideId, status: 'IN_PROGRESS', timestamp: new Date() });
    return updated;
  }

  async complete(userId: string, rideId: string, dto: CompleteRideDto) {
    const ride = await this.assertDriverOwnsRide(userId, rideId, ['IN_PROGRESS']);
    const rideType = await this.prisma.rideType.findUniqueOrThrow({ where: { id: ride.rideTypeId } });

    const finalDistanceKm = dto.finalDistanceKm ?? Number(ride.distanceKm ?? 0);
    const finalDurationMin = dto.finalDurationMin ?? ride.durationMin ?? 0;
    const fare = this.pricing.calculateFare(rideType, finalDistanceKm, finalDurationMin, Number(ride.surgeMultiplier));
    const totalFare = Number((fare.subtotal - Number(ride.promoDiscount)).toFixed(2));

    const updated = await this.prisma.$transaction(async (tx) => {
      const completedRide = await tx.ride.update({
        where: { id: ride.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          distanceKm: finalDistanceKm,
          durationMin: finalDurationMin,
          distanceFare: fare.distanceFare,
          timeFare: fare.timeFare,
          totalFare,
        },
      });
      await tx.driverProfile.update({ where: { id: ride.driverId! }, data: { totalTrips: { increment: 1 } } });
      return completedRide;
    });

    // Card/wallet settle automatically on completion; cash is collected in person
    // (see PaymentsService — the Payment row is still written for reconciliation).
    const method = await this.resolvePaymentMethod(ride.passengerId);
    await this.payments.charge({ rideId: ride.id, userId: ride.passengerId, method, amount: totalFare });

    this.realtime.emitToRide(rideId, 'ride.status_changed', { rideId, status: 'COMPLETED', timestamp: new Date() });
    return updated;
  }

  private async resolvePaymentMethod(userId: string): Promise<'CARD' | 'CASH' | 'WALLET'> {
    const defaultMethod = await this.prisma.paymentMethod.findFirst({ where: { userId, isDefault: true } });
    return defaultMethod ? 'CARD' : 'WALLET';
  }

  // ---------- promo ----------

  async applyPromo(userId: string, rideId: string, code: string) {
    const ride = await this.getRideOr404(rideId);
    if (ride.passengerId !== userId) throw new ForbiddenException('Not your ride');
    if (['COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'].includes(ride.status)) {
      throw new ConflictException('Ride already finished');
    }

    const validation = await this.promo.validate(code);
    if (!validation.valid) throw new BadRequestException(validation.reason ?? 'Invalid promo code');

    const subtotal = Number(ride.baseFare) + Number(ride.distanceFare) + Number(ride.timeFare);
    const discount = this.promo.calculateDiscount(subtotal, validation);

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: { promoDiscount: discount, totalFare: Number((subtotal - discount).toFixed(2)) },
    });
    await this.promo.redeem(code, userId, rideId);
    return updated;
  }

  // ---------- ratings ----------

  async rate(userId: string, rideId: string, dto: RateRideDto) {
    const ride = await this.getRideOr404(rideId);
    if (ride.status !== 'COMPLETED') throw new ConflictException('Can only rate a completed ride');

    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    const isPassenger = ride.passengerId === userId;
    const isDriver = driverProfile && ride.driverId === driverProfile.id;
    if (!isPassenger && !isDriver) throw new ForbiddenException('Not a party to this ride');

    const rateeUserId = isPassenger
      ? (await this.prisma.driverProfile.findUniqueOrThrow({ where: { id: ride.driverId! } })).userId
      : ride.passengerId;

    const existing = await this.prisma.rating.findUnique({
      where: { rideId_raterId: { rideId, raterId: userId } },
    });
    if (existing) throw new ConflictException('You already rated this ride');

    const rating = await this.prisma.rating.create({
      data: { rideId, raterId: userId, rateeId: rateeUserId, stars: dto.stars, comment: dto.comment },
    });

    await this.recomputeRatingAverage(rateeUserId);
    return rating;
  }

  private async recomputeRatingAverage(rateeUserId: string) {
    const agg = await this.prisma.rating.aggregate({
      where: { rateeId: rateeUserId },
      _avg: { stars: true },
      _count: true,
    });
    await this.prisma.user.update({
      where: { id: rateeUserId },
      data: { ratingAvg: agg._avg.stars ?? 5, ratingCount: agg._count },
    });
    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId: rateeUserId } });
    if (driverProfile) {
      await this.prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: { ratingAvg: agg._avg.stars ?? 5, ratingCount: agg._count },
      });
    }
  }

  // ---------- shared helpers ----------

  private async getRideOr404(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  private async driverProfileOrThrow(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('No driver profile for this user');
    return profile;
  }

  private async assertDriverOwnsRide(userId: string, rideId: string, expectedStatuses: string[]) {
    const driverProfile = await this.driverProfileOrThrow(userId);
    const ride = await this.getRideOr404(rideId);
    if (ride.driverId !== driverProfile.id) throw new ForbiddenException('Not the assigned driver');
    if (!expectedStatuses.includes(ride.status)) {
      throw new ConflictException(`Ride must be ${expectedStatuses.join(' or ')}, currently ${ride.status}`);
    }
    return ride;
  }
}
