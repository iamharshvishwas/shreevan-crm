import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from './decorators';
import { AuthUser } from './auth.types';
import { ForbiddenError } from '../errors/domain.errors';
import { PrismaService } from '../../database/prisma.service';

/**
 * Enforces @Roles(...) on the server. ADMIN passes everything.
 *
 * The user's role is read FRESH from the DB (not the JWT) so that promoting or
 * demoting an admin takes effect immediately — a demoted admin loses admin-only
 * API access on their very next request, without waiting for their token to
 * expire. Consistent with ScreensGuard's DB-fresh model.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenError();

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!row) throw new ForbiddenError();
    if (row.role === Role.ADMIN) return true;
    if (!required.includes(row.role)) throw new ForbiddenError();
    return true;
  }
}
