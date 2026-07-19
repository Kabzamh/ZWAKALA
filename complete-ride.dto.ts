import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class CompleteRideDto {
  @IsOptional()
  @IsNumber()
  finalDistanceKm?: number;

  @IsOptional()
  @IsInt()
  finalDurationMin?: number;
}
