import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request } from 'express';

export interface AuthParticipant {
  id: string;
  email: string;
  name: string;
}

interface ParticipantTokenPayload {
  sub: string;
  email: string;
  name: string;
  typ: 'participant';
}

/** Token secret for participants — derived from JWT_ACCESS_SECRET but distinct,
 *  so a participant token can never be accepted by the staff guard (or vice versa). */
export function participantSecret(config: ConfigService): string {
  const base = config.get<string>('JWT_ACCESS_SECRET') ?? 'shreevan-dev-secret';
  return createHash('sha256').update(`${base}:participant`).digest('hex');
}

/** Validates a participant Bearer token and attaches req.participant. */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing participant token.');
    try {
      const payload = await this.jwt.verifyAsync<ParticipantTokenPayload>(header.slice(7), {
        secret: participantSecret(this.config),
      });
      if (payload.typ !== 'participant') throw new Error('wrong token type');
      (req as Request & { participant: AuthParticipant }).participant = {
        id: payload.sub, email: payload.email, name: payload.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired participant token.');
    }
  }
}

/** Inject the authenticated participant into a handler param. */
export const CurrentParticipant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthParticipant =>
    ctx.switchToHttp().getRequest().participant as AuthParticipant,
);
