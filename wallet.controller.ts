import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';
import { WalletService } from './wallet.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

class TopupDto {
  @IsNumber() @IsPositive() amount: number;
  @IsUUID() paymentMethodId: string;
}

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.wallet.getWithHistory(user.userId);
  }

  @Post('topup')
  topup(@CurrentUser() user: AuthUser, @Body() dto: TopupDto) {
    // paymentMethodId charge would go through PaymentsService/Stripe in production;
    // the skeleton credits the wallet directly to keep the demo self-contained.
    return this.wallet.credit(user.userId, dto.amount, 'TOPUP', dto.paymentMethodId);
  }
}
