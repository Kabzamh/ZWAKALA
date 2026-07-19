import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RideTypesService {
  constructor(private prisma: PrismaService) {}

  // `lat`/`lng` are accepted (per the API spec) to support market-specific
  // ride type availability later — unused for now since the MVP is single-market.
  findAvailable(_lat: number, _lng: number) {
    return this.prisma.rideType.findMany({ where: { isActive: true }, orderBy: { baseFare: 'asc' } });
  }
}
