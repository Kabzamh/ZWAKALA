import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PricingService } from './pricing.service';
import { MatchingService } from './matching.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { PromoModule } from '../promo/promo.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [RealtimeModule, PromoModule, PaymentsModule],
  controllers: [RidesController],
  providers: [RidesService, PricingService, MatchingService],
  exports: [RidesService],
})
export class RidesModule {}
