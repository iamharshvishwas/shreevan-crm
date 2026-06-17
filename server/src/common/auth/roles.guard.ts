import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from './decorators';
import { AuthUser } from './auth.types';
import { ForbiddenError } from '../errors/domain.errors';

/** Enforces @Roles(...) on the server. ADMIN passes everything. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenError();
    if (user.role === Role.ADMIN) return true;
    if (!required.includes(user.role)) throw new ForbiddenError();
    return true;
  }
}
