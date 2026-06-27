import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as otplib from 'otplib';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DomainError } from '../../common/errors/domain.errors';
import { encryptSecret, decryptSecret } from '../../common/crypto/secret-box';

const ISSUER = 'Shreevan CRM';
const BACKUP_CODE_COUNT = 8;

const hashCode = (c: string): string => createHash('sha256').update(c.replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex');

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  /** Begin enrolment: generate a secret, store it (encrypted) as pending, and
   *  return the QR + manual key for the authenticator app. Not active until verified. */
  async startSetup(userId: string, email: string): Promise<{ otpauthUri: string; qrDataUrl: string; secret: string }> {
    const secret = await otplib.generateSecret();
    const otpauthUri = await otplib.generateURI({ secret, label: email, issuer: ISSUER });
    const qrcode = await import('qrcode');
    const qrDataUrl = await qrcode.toDataURL(otpauthUri);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorPendingSecret: encryptSecret(secret) } });
    return { otpauthUri, qrDataUrl, secret };
  }

  /** Verify the first code against the pending secret → activate 2FA, return one-time backup codes. */
  async enable(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorPendingSecret) {
      throw new DomainError('NO_PENDING_2FA', 'Start 2FA setup first.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const secret = decryptSecret(user.twoFactorPendingSecret);
    if (!(await this.checkTotp(secret, code))) {
      throw new DomainError('INVALID_2FA_CODE', 'That code is incorrect — check the app and try again.', HttpStatus.UNPROCESSABLE_ENTITY, { code: ['Incorrect code.'] });
    }
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => this.genBackupCode());
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: backupCodes.map(hashCode),
      },
    });
    return { backupCodes };
  }

  /** Disable 2FA after verifying a current code (or a backup code). */
  async disable(userId: string, code: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) return { ok: true };
    if (!(await this.verifyForUser(user, code))) {
      throw new DomainError('INVALID_2FA_CODE', 'That code is incorrect.', HttpStatus.UNPROCESSABLE_ENTITY, { code: ['Incorrect code.'] });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorBackupCodes: [] },
    });
    return { ok: true };
  }

  async status(userId: string): Promise<{ enabled: boolean }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
    return { enabled: !!u?.twoFactorEnabled };
  }

  /** Validate a login-time code: TOTP first, then a one-time backup code (consumed). */
  async verifyForUser(user: User, code: string): Promise<boolean> {
    if (user.twoFactorSecret && (await this.checkTotp(decryptSecret(user.twoFactorSecret), code))) return true;
    // Backup code fallback (single use).
    const h = hashCode(code);
    if (user.twoFactorBackupCodes.includes(h)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: user.twoFactorBackupCodes.filter((c) => c !== h) },
      });
      return true;
    }
    return false;
  }

  private async checkTotp(secret: string, token: string): Promise<boolean> {
    const clean = (token ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    try {
      const res = await otplib.verify({ token: clean, secret });
      return !!res?.valid;
    } catch {
      return false;
    }
  }

  private genBackupCode(): string {
    const raw = randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }
}
