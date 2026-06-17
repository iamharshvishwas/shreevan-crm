import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC } from './decorators';
import { AccessTokenPayload } from './auth.types';

/** Verifies the Bearer access token and attaches req.user. Applied globally. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      (req as Request & { user: unknown }).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
