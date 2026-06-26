import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../../common/errors/domain.errors';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { TokensDto } from './dto/auth.dto';

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

const MAX_LOGIN_ATTEMPTS = 5;        // consecutive failures before lockout
const LOCKOUT_MS = 15 * 60_000;      // 15-minute lockout

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, meta?: { ip?: string; userAgent?: string }): Promise<TokensDto> {
    const user = await this.users.findByEmail(email);

    // Account lockout: after too many failures, refuse for a cooldown window.
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }

    // Verify even when the user is missing-ish to reduce timing signal.
    const ok = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
    if (!user || !ok) {
      if (user) await this.registerFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.isActive) throw new UnauthorizedException('This account is disabled.');

    // Success → clear any failure counter / lockout.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }
    return this.issueTokens({ sub: user.id, email: user.email, role: user.role }, meta);
  }

  /** Bump the failed-attempt counter; lock the account once it hits the cap. */
  private async registerFailedLogin(userId: string, current: number): Promise<void> {
    const attempts = current + 1;
    const data = attempts >= MAX_LOGIN_ATTEMPTS
      ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
      : { failedLoginAttempts: attempts };
    await this.prisma.user.update({ where: { id: userId }, data });
  }

  async refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }): Promise<TokensDto> {
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh session.');
    }
    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('Account unavailable.');
    // Rotate: revoke the used session, issue a fresh pair.
    await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens({ sub: user.id, email: user.email, role: user.role }, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Change the signed-in user's password. Verifies the current password,
   * stores the new hash, revokes ALL existing sessions (security), then issues
   * a fresh session so the current device stays logged in seamlessly.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<TokensDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account unavailable.');

    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) {
      throw new DomainError('INVALID_PASSWORD', 'Your current password is incorrect.', HttpStatus.UNPROCESSABLE_ENTITY, {
        currentPassword: ['Incorrect password.'],
      });
    }
    if (await argon2.verify(user.passwordHash, newPassword).catch(() => false)) {
      throw new DomainError('SAME_PASSWORD', 'New password must be different from the current one.', HttpStatus.UNPROCESSABLE_ENTITY, {
        newPassword: ['Choose a different password.'],
      });
    }

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword) } });
    await this.logoutAll(userId); // invalidate every old session on password change
    return this.issueTokens({ sub: user.id, email: user.email, role: user.role }, meta);
  }

  private async issueTokens(payload: AccessTokenPayload, meta?: { ip?: string; userAgent?: string }): Promise<TokensDto> {
    const accessTtl = this.config.get<number>('JWT_ACCESS_TTL')!;
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL')!;

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshSession.create({
      data: {
        userId: payload.sub,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }
}
