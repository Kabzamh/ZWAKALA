import { IsString } from 'class-validator';

export class ValidatePromoDto {
  @IsString()
  code: string;
}
