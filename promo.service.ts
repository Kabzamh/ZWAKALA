import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PromoValidation {
  valid: boolean;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  reason?: string;
}

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  async validate(code: string): Promise<PromoValidation> {
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) return { valid: false, reason: 'Code not found' };
    if (promo.expiresAt && promo.expiresAt < new Date()) return { valid: false, reason: 'Code has expired' };
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, reason: 'Code has reached its usage limit' };
    }
    return {
      valid: true,
      discountType: promo.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT',
      discountValue: Number(promo.discountValue),
    };
  }

  calculateDiscount(fare: number, validation: PromoValidation): number {
    if (!validation.valid || !validation.discountType || validation.discountValue === undefined) return 0;
    const discount =
      validation.discountType === 'PERCENTAGE'
        ? fare * (validation.discountValue / 100)
        : validation.discountValue;
    return Number(Math.min(discount, fare).toFixed(2));
  }

  async redeem(code: string, userId: string, rideId: string) {
    const promo = await this.prisma.promoCode.findUniqueOrThrow({ where: { code } });
    await this.prisma.$transaction([
      this.prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
      this.prisma.promoRedemption.create({ data: { promoId: promo.id, userId, rideId } }),
    ]);
  }
}
