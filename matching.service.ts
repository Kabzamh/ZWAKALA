import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const OFFER_TIMEOUT_MS = 15_000;
const DISPATCH_DELAY_MS = 2_000; // mirrors the prototype's "searching" radar animation

/**
 * Offer-based dispatch: one driver holds the offer for a ride at a time.
 * They accept/decline via the Rides controller; a timeout auto-declines and
 * moves to the next-nearest candidate, per the API design notes.
 *
 * State (`offeredDriverByRide`, `declinedDriversByRide`) is in-memory and
 * scoped to a single instance — move to Redis before running >1 API replica,
 * and swap the "nearest online driver" query for a real geo-index (PostGIS /
 * Redis GEO) instead of "any online approved driver."
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger('MatchingService');
  private offeredDriverByRide = new Map<string, string>();
  private declinedDriversByRide = new Map<string, Set<string>>();

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  dispatch(rideId: string) {
    setTimeout(() => this.attemptOffer(rideId), DISPATCH_DELAY_MS);
  }

  async acceptOffer(rideId: string, driverId: string) {
    if (this.offeredDriverByRide.get(rideId) !== driverId) {
      throw new ConflictException('This ride is no longer being offered to you');
    }
    this.offeredDriverByRide.delete(rideId);
    this.declinedDriversByRide.delete(rideId);

    const driver = await this.prisma.driverProfile.findUniqueOrThrow({
      where: { id: driverId },
      include: { vehicles: { where: { status: 'ACTIVE' }, take: 1 } },
    });

    const ride = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'ACCEPTED',
        driverId,
        vehicleId: driver.vehicles[0]?.id,
        acceptedAt: new Date(),
      },
      include: { vehicle: true, rideType: true },
    });

    this.realtime.emitToRide(rideId, 'ride.driver_assigned', {
      rideId,
      driver: { id: driver.id, currentLat: driver.currentLat, currentLng: driver.currentLng },
      vehicle: ride.vehicle,
      etaSeconds: 240,
    });
    this.realtime.emitToRide(rideId, 'ride.status_changed', { rideId, status: 'ACCEPTED', timestamp: new Date() });

    return ride;
  }

  declineOffer(rideId: string, driverId: string) {
    if (this.offeredDriverByRide.get(rideId) !== driverId) {
      throw new ConflictException('This ride is no longer being offered to you');
    }
    this.markDeclinedAndRedispatch(rideId, driverId);
  }

  private async attemptOffer(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'REQUESTED') return; // cancelled or already matched

    const declined = this.declinedDriversByRide.get(rideId) ?? new Set<string>();

    const driver = await this.prisma.driverProfile.findFirst({
      where: {
        isOnline: true,
        status: 'APPROVED',
        id: { notIn: [...declined] },
        vehicles: { some: { status: 'ACTIVE' } },
      },
    });

    if (!driver) {
      await this.prisma.ride.update({ where: { id: rideId }, data: { status: 'NO_DRIVERS_FOUND' } });
      this.realtime.emitToRide(rideId, 'ride.no_drivers_found', { rideId });
      this.logger.warn(`No drivers available for ride ${rideId}`);
      return;
    }

    this.offeredDriverByRide.set(rideId, driver.id);
    this.realtime.emitToDriver(driver.id, 'ride.request_offer', {
      rideId,
      pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
      dropoff: { address: ride.dropoffAddress, lat: ride.dropoffLat, lng: ride.dropoffLng },
      estimatedFare: ride.totalFare,
      expiresInSeconds: OFFER_TIMEOUT_MS / 1000,
    });

    setTimeout(() => this.expireOfferIfUnanswered(rideId, driver.id), OFFER_TIMEOUT_MS);
  }

  private async expireOfferIfUnanswered(rideId: string, driverId: string) {
    if (this.offeredDriverByRide.get(rideId) !== driverId) return; // already accepted/declined
    this.realtime.emitToDriver(driverId, 'ride.offer_expired', { rideId });
    this.markDeclinedAndRedispatch(rideId, driverId);
  }

  private markDeclinedAndRedispatch(rideId: string, driverId: string) {
    this.offeredDriverByRide.delete(rideId);
    const set = this.declinedDriversByRide.get(rideId) ?? new Set<string>();
    set.add(driverId);
    this.declinedDriversByRide.set(rideId, set);
    this.attemptOffer(rideId);
  }
}
