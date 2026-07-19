import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getWithHistory(userId: string) {
    const wallet = await this.getOrCreate(userId);
    const recentTransactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { balance: wallet.balance, currency: wallet.currency, recentTransactions };
  }

  async credit(userId: string, amount: number, reason: 'TOPUP' | 'REFUND' | 'PROMO_CREDIT', reference?: string) {
    const wallet = await this.getOrCreate(userId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: 'CREDIT', reason, amount, reference },
      });
      return updated;
    });
  }

  async debit(userId: string, amount: number, reason: 'RIDE_PAYMENT' | 'TIP', reference?: string) {
    const wallet = await this.getOrCreate(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: 'DEBIT', reason, amount, reference },
      });
      return updated;
    });
  }
}
