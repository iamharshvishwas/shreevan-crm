import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../database/prisma.service';
import { participantSecret, type AuthParticipant } from './participant-auth.guard';

export interface ParticipantSession {
  token: string;
  participant: AuthParticipant;
}

@Injectable()
export class ParticipantAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(email: string, name: string, password: string): Promise<ParticipantSession> {
    const normEmail = email.trim().toLowerCase();
    const existing = await this.prisma.participant.findUnique({ where: { email: normEmail } });
    if (existing) throw new ConflictException('An account with this email already exists — please sign in.');
    const passwordHash = await argon2.hash(password);
    const p = await this.prisma.participant.create({ data: { email: normEmail, name: name.trim(), passwordHash } });
    return this.session(p);
  }

  async login(email: string, password: string): Promise<ParticipantSession> {
    const p = await this.prisma.participant.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Verify even when missing to keep timing uniform.
    const ok = p ? await argon2.verify(p.passwordHash, password).catch(() => false) : false;
    if (!p || !ok) throw new UnauthorizedException('Incorrect email or password.');
    return this.session(p);
  }

  private async session(p: { id: string; email: string; name: string }): Promise<ParticipantSession> {
    const token = await this.jwt.signAsync(
      { sub: p.id, email: p.email, name: p.name, typ: 'participant' },
      { secret: participantSecret(this.config), expiresIn: '7d' },
    );
    return { token, participant: { id: p.id, email: p.email, name: p.name } };
  }
}
