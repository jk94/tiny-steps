import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Injects the authenticated user attached to the request by `JwtStrategy`.
 * Only valid on routes guarded by `JwtAuthGuard`. Not unit-tested on its
 * own per NestJS's own guidance on param decorators — covered via the
 * `GET /api/auth/me` e2e test instead.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
