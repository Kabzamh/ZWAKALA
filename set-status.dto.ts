import { IsBoolean } from 'class-validator';

export class SetDriverStatusDto {
  @IsBoolean()
  isOnline: boolean;
}
