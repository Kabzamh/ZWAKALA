import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * Mock payment provider: card/wallet charges always succeed after a short
 * simulated delay. Swap `chargeCard` for a real Stripe PaymentIntent
 * create+confirm call — the Payment row's `providerRef` field is already
 * shaped to hold a Stripe payment_intent id.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
  ) {}

  async charge(params: {
    rideId: string;
    userId: string;
    method: 'CARD' | 'CASH' | 'WALLET';
    amount: number;
    tipAmount?: number;
  }) {
    const { rideId, userId, method, amount, tipAmount = 0 } = params;
    const total = amount + tipAmount;

    if (method === 'WALLET') {
      await this.wallet.debit(userId, total, 'RIDE_PAYMENT', rideId);
    } else if (method === 'CARD') {
      await this.chargeCard(userId, total);
    }
    // CASH: nothing to charge electronically — driver collects in person,
    // the Payment row still records it for reporting/reconciliation.

    return this.prisma.payment.upsert({
      where: { rideId },
      update: { amount, tipAmount, method, status: 'CAPTURED' },
      create: {
        rideId,
        userId,
        method,
        amount,
        tipAmount,
        status: 'CAPTURED',
        providerRef: method === 'CARD' ? `mock_pi_${rideId.slice(0, 8)}` : undefined,
      },
    });
  }

  private async chargeCard(userId: string, amount: number) {
    this.logger.log(`Mock-charging card for user ${userId}: R${amount.toFixed(2)}`);
    // Simulated network latency; real implementation awaits Stripe's response
    // and throws (mapped to 402 PAYMENT_DECLINED) on a declined card.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}
