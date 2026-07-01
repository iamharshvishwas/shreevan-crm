import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { participantSecret } from './participant/participant-auth.guard';
import { instructorSecret } from './instructor/instructor-auth.guard';

/** Either kind of class member — a learner (participant) or the host (instructor). */
export interface ClassMember {
  kind: 'participant' | 'host';
  id: string;
  name: string;
}

/** Accepts EITHER a participant or an instructor token — used for shared
 *  in-room reads/writes (chat list/post, poll read) where both roles take part. */
@Injectable()
export class ClassMemberGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token.');
    const token = header.slice(7);

    const tryVerify = async (secret: string) => {
      try { return await this.jwt.verifyAsync<{ sub: string; name: string; typ: string }>(token, { secret }); }
      catch { return null; }
    };

    const asParticipant = await tryVerify(participantSecret(this.config));
    if (asParticipant?.typ === 'participant') {
      (req as Request & { member: ClassMember }).member = { kind: 'participant', id: asParticipant.sub, name: asParticipant.name };
      return true;
    }
    const asHost = await tryVerify(instructorSecret(this.config));
    if (asHost?.typ === 'instructor') {
      (req as Request & { member: ClassMember }).member = { kind: 'host', id: asHost.sub, name: asHost.name };
      return true;
    }
    throw new UnauthorizedException('Invalid or expired token.');
  }
}

export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClassMember =>
    ctx.switchToHttp().getRequest().member as ClassMember,
);
