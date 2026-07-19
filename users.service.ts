import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SavedAddressDto } from './dto/saved-address.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  update(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  listAddresses(userId: string) {
    return this.prisma.savedAddress.findMany({ where: { userId }, orderBy: { label: 'asc' } });
  }

  addAddress(userId: string, dto: SavedAddressDto) {
    return this.prisma.savedAddress.create({ data: { ...dto, userId } });
  }

  async removeAddress(userId: string, addressId: string) {
    const address = await this.prisma.savedAddress.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) throw new NotFoundException('Address not found');
    await this.prisma.savedAddress.delete({ where: { id: addressId } });
  }

  listPaymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({ where: { userId } });
  }

  addPaymentMethod(userId: string, providerToken: string, setAsDefault: boolean) {
    // In production this exchanges providerToken with Stripe for a payment_method id
    // and stores that reference — never raw card data — plus brand/last4 from the API response.
    return this.prisma.paymentMethod.create({
      data: {
        userId,
        type: 'CARD',
        cardBrand: 'visa',
        cardLast4: '4242',
        isDefault: setAsDefault,
      },
    });
  }

  async removePaymentMethod(userId: string, methodId: string) {
    const method = await this.prisma.paymentMethod.findUnique({ where: { id: methodId } });
    if (!method || method.userId !== userId) throw new NotFoundException('Payment method not found');
    await this.prisma.paymentMethod.delete({ where: { id: methodId } });
  }
}
