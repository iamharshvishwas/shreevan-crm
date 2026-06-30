import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request } from 'express';

export interface AuthInstructor {
  id: string;
  email: string;
  name: string;
}

interface InstructorTokenPayload {
  sub: string;
  email: string;
  name: string;
  typ: 'instructor';
}

/** Token secret for instructors — derived from JWT_ACCESS_SECRET but distinct
 *  from the staff and participant secrets, so the three token kinds can never
 *  cross-validate. */
export function instructorSecret(config: ConfigService): string {
  const base = config.get<string>('JWT_ACCESS_SECRET') ?? 'shreevan-dev-secret';
  return createHash('sha256').update(`${base}:instructor`).digest('hex');
}

/** Validates an instructor Bearer token and attaches req.instructor. */
@Injectable()
export class InstructorGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing instructor token.');
    try {
      const payload = await this.jwt.verifyAsync<InstructorTokenPayload>(header.slice(7), {
        secret: instructorSecret(this.config),
      });
      if (payload.typ !== 'instructor') throw new Error('wrong token type');
      (req as Request & { instructor: AuthInstructor }).instructor = {
        id: payload.sub, email: payload.email, name: payload.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired instructor token.');
    }
  }
}

/** Inject the authenticated instructor into a handler param. */
export const CurrentInstructor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthInstructor =>
    ctx.switchToHttp().getRequest().instructor as AuthInstructor,
);
