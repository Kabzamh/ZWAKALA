import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class RetryPaymentDto {
  @IsOptional() @IsUUID() paymentMethodId?: string;
  @IsOptional() @IsNumber() @Min(0) tipAmount?: number;
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('rides/:rideId/pay')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private prisma: PrismaService,
  ) {}

  @Post()
  async retry(
    @CurrentUser() user: AuthUser,
    @Param('rideId') rideId: string,
    @Body() dto: RetryPaymentDto,
  ) {
    const ride = await this.prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
    return this.payments.charge({
      rideId,
      userId: user.userId,
      method: 'CARD',
      amount: Number(ride.totalFare ?? 0),
      tipAmount: dto.tipAmount ?? 0,
    });
  }
}
