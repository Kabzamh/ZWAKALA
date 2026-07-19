import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RidesService } from './rides.service';
import { EstimateRideDto } from './dto/estimate.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CompleteRideDto } from './dto/complete-ride.dto';
import { ApplyPromoDto } from './dto/apply-promo.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Rides')
@ApiBearerAuth()
@Controller('rides')
export class RidesController {
  constructor(private rides: RidesService) {}

  // ---- passenger ----

  @Post('estimate')
  estimate(@Body() dto: EstimateRideDto) {
    return this.rides.estimate(dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRideDto) {
    return this.rides.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto, @Query('status') status?: string) {
    return this.rides.list(user.userId, status, pagination.page, pagination.pageSize);
  }

  @Get(':rideId')
  findOne(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.rides.findOne(user.userId, rideId);
  }

  @Post(':rideId/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string, @Body() dto: CancelRideDto) {
    return this.rides.cancel(user.userId, rideId, dto.reason);
  }

  @Post(':rideId/apply-promo')
  applyPromo(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string, @Body() dto: ApplyPromoDto) {
    return this.rides.applyPromo(user.userId, rideId, dto.code);
  }

  @Post(':rideId/rating')
  rate(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string, @Body() dto: RateRideDto) {
    return this.rides.rate(user.userId, rideId, dto);
  }

  // ---- driver ----

  @Post(':rideId/accept')
  accept(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.rides.accept(user.userId, rideId);
  }

  @Post(':rideId/decline')
  decline(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.rides.decline(user.userId, rideId);
  }

  @Post(':rideId/arrived')
  arrived(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.rides.markArrived(user.userId, rideId);
  }

  @Post(':rideId/start')
  start(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string) {
    return this.rides.start(user.userId, rideId);
  }

  @Post(':rideId/complete')
  complete(@CurrentUser() user: AuthUser, @Param('rideId') rideId: string, @Body() dto: CompleteRideDto) {
    return this.rides.complete(user.userId, rideId, dto);
  }
}
