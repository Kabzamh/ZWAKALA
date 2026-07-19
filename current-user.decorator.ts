import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  role: 'PASSENGER' | 'DRIVER' | 'ADMIN';
}

/** Pulls the authenticated user off the request, populated by JwtStrategy. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
