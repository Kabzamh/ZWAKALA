import { IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @IsPhoneNumber(undefined, { message: 'phone must be a valid E.164 phone number, e.g. +27821234567' })
  phone: string;
}
