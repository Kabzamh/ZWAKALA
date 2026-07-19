import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring a bearer token — used on the OTP endpoints. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
