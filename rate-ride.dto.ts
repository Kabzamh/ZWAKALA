import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateRideDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
