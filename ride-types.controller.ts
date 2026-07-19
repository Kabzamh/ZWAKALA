import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';
import { RideTypesService } from './ride-types.service';

class RideTypesQuery {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

@ApiTags('RideTypes')
@ApiBearerAuth()
@Controller('ride-types')
export class RideTypesController {
  constructor(private rideTypes: RideTypesService) {}

  @Get()
  list(@Query() query: RideTypesQuery) {
    return this.rideTypes.findAvailable(query.lat, query.lng);
  }
}
