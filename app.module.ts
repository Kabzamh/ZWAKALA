import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RideTypesModule } from './ride-types/ride-types.module';
import { RidesModule } from './rides/rides.module';
import { DriverModule } from './driver/driver.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { PromoModule } from './promo/promo.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RideTypesModule,
    RidesModule,
    DriverModule,
    PaymentsModule,
    WalletModule,
    PromoModule,
  ],
})
export class AppModule {}
