import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './auth.types';

/** Mark a route as public — skips the global JWT guard (login, webhooks, health). */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restrict a route to specific roles (enforced by RolesGuard). */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
