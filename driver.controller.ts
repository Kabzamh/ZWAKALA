import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriverService } from './driver.service';
import { SetDriverStatusDto } from './dto/set-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Driver')
@ApiBearerAuth()
@Controller('driver')
export class DriverController {
  constructor(private driver: DriverService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.driver.getMyProfile(user.userId);
  }

  @Patch('status')
  setStatus(@CurrentUser() user: AuthUser, @Body() dto: SetDriverStatusDto) {
    return this.driver.setOnlineStatus(user.userId, dto.isOnline);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('location')
  updateLocation(@CurrentUser() user: AuthUser, @Body() dto: UpdateLocationDto) {
    return this.driver.updateLocation(user.userId, dto.lat, dto.lng, dto.heading);
  }
}
