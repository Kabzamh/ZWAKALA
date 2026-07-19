import { Module } from '@nestjs/common';
import { RideTypesController } from './ride-types.controller';
import { RideTypesService } from './ride-types.service';

@Module({
  controllers: [RideTypesController],
  providers: [RideTypesService],
  exports: [RideTypesService],
})
export class RideTypesModule {}
