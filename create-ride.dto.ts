import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRideDto {
  @IsUUID()
  rideTypeId: string;

  @IsString() pickupAddress: string;
  @IsLatitude() pickupLat: number;
  @IsLongitude() pickupLng: number;

  @IsString() dropoffAddress: string;
  @IsLatitude() dropoffLat: number;
  @IsLongitude() dropoffLng: number;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;
}
