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
    // Verify even when the user is missing-ish to reduce timing signal.
    const ok = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password.');
    if (!user.isActive) throw new UnauthorizedException('This account is disabled.');
    return this.issueTokens({ sub: user.id, email: user.email, role: user.role }, meta);
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
