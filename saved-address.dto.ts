import { IsLatitude, IsLongitude, IsString } from 'class-validator';

export class SavedAddressDto {
  @IsString()
  label: string;

  @IsString()
  address: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
