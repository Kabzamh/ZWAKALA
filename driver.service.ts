import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async getMyProfile(userId: string) {
    return this.profileForUser(userId);
  }

  private async profileForUser(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('No driver profile for this user');
    return profile;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const profile = await this.profileForUser(userId);
    return this.prisma.driverProfile.update({ where: { id: profile.id }, data: { isOnline } });
  }

  async updateLocation(userId: string, lat: number, lng: number, heading?: number) {
    const profile = await this.profileForUser(userId);
    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { currentLat: lat, currentLng: lng },
    });

    // Broadcast to any ride room this driver is currently on — the passenger
    // app's live car marker listens for this event directly.
    const activeRide = await this.prisma.ride.findFirst({
      where: { driverId: profile.id, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    });
    if (activeRide) {
      this.realtime.emitToRide(activeRide.id, 'driver.location_updated', {
        rideId: activeRide.id,
        lat,
        lng,
        heading,
      });
    }
  }
}
