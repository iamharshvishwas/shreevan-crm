import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC, SCREENS_KEY } from './decorators';
import { ScreenKey } from './screens';
import { AuthUser } from './auth.types';
import { ForbiddenError } from '../errors/domain.errors';
import { PrismaService } from '../../database/prisma.service';

/**
 * Enforces @RequireScreens(...) on the server. ADMIN passes everything.
 * A user passes if ANY required screen is in their allowedScreens.
 *
 * allowedScreens is read fresh from the DB per gated request (not from the
 * JWT), so an admin changing a user's access takes effect immediately without
 * a re-login, and the sensitive JWT/2FA token payload is left untouched.
 */
@Injectable()
export class ScreensGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Public routes (webhooks, widget endpoints, intake forms) are never gated,
    // even when their controller carries a class-level @RequireScreens.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<ScreenKey[]>(SCREENS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenError();

    // Read role + screens fresh from the DB (not the JWT) so admin promote/
    // demote and screen changes all take effect immediately, without a re-login.
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, allowedScreens: true },
    });
    if (!row) throw new ForbiddenError();
    if (row.role === Role.ADMIN) return true;

    if (!required.some((screen) => row.allowedScreens.includes(screen))) throw new ForbiddenError();
    return true;
  }
}
