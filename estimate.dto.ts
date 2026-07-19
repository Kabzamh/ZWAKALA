import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class EstimateRideDto {
  @IsLatitude() pickupLat: number;
  @IsLongitude() pickupLng: number;
  @IsLatitude() dropoffLat: number;
  @IsLongitude() dropoffLng: number;

  @IsOptional()
  @IsString()
  promoCode?: string;
}
