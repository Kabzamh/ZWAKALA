import { IsString } from 'class-validator';

export class ApplyPromoDto {
  @IsString()
  code: string;
}
