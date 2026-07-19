import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SavedAddressDto } from './dto/saved-address.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.userId);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.users.update(user.userId, dto);
  }

  @Get('saved-addresses')
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.users.listAddresses(user.userId);
  }

  @Post('saved-addresses')
  addAddress(@CurrentUser() user: AuthUser, @Body() dto: SavedAddressDto) {
    return this.users.addAddress(user.userId, dto);
  }

  @Delete('saved-addresses/:addressId')
  removeAddress(@CurrentUser() user: AuthUser, @Param('addressId') addressId: string) {
    return this.users.removeAddress(user.userId, addressId);
  }

  @Get('payment-methods')
  listPaymentMethods(@CurrentUser() user: AuthUser) {
    return this.users.listPaymentMethods(user.userId);
  }

  @Post('payment-methods')
  addPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Body('providerToken') providerToken: string,
    @Body('setAsDefault') setAsDefault = false,
  ) {
    return this.users.addPaymentMethod(user.userId, providerToken, setAsDefault);
  }

  @Delete('payment-methods/:methodId')
  removePaymentMethod(@CurrentUser() user: AuthUser, @Param('methodId') methodId: string) {
    return this.users.removePaymentMethod(user.userId, methodId);
  }
}
