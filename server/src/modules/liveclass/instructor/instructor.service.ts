import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../database/prisma.service';
import { instructorSecret, type AuthInstructor } from './instructor-auth.guard';

export interface InstructorSession {
  token: string;
  instructor: AuthInstructor;
}

const publicShape = { id: true, email: true, name: true, isActive: true, createdAt: true } as const;

const MAX_LOGIN_ATTEMPTS = 5;   // consecutive failures before lockout
const LOCKOUT_MS = 15 * 60_000; // 15-minute lockout

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---- Instructor login (no self-signup; admin creates accounts) ----

  async login(email: string, password: string): Promise<InstructorSession> {
    const i = await this.prisma.instructor.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Lockout: after too many consecutive failures, refuse for a cooldown window.
    if (i?.lockedUntil && i.lockedUntil > new Date()) {
      throw new UnauthorizedException('Too many failed attempts — try again in about 15 minutes.');
    }

    const ok = i ? await argon2.verify(i.passwordHash, password).catch(() => false) : false;
    if (!i || !ok) {
      if (i) {
        const attempts = i.failedLoginAttempts + 1;
        await this.prisma.instructor.update({
          where: { id: i.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil: attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
          },
        });
      }
      throw new UnauthorizedException('Incorrect email or password.');
    }
    if (!i.isActive) throw new UnauthorizedException('This instructor account is disabled.');

    if (i.failedLoginAttempts > 0 || i.lockedUntil) {
      await this.prisma.instructor.update({ where: { id: i.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const token = await this.jwt.signAsync(
      { sub: i.id, email: i.email, name: i.name, typ: 'instructor' },
      { secret: instructorSecret(this.config), expiresIn: '7d' },
    );
    return { token, instructor: { id: i.id, email: i.email, name: i.name } };
  }

  // ---- Admin (CRM staff) management ----

  async adminCreate(name: string, email: string, password: string) {
    const normEmail = email.trim().toLowerCase();
    const existing = await this.prisma.instructor.findUnique({ where: { email: normEmail } });
    if (existing) throw new ConflictException('An instructor with this email already exists.');
    const passwordHash = await argon2.hash(password);
    return this.prisma.instructor.create({
      data: { name: name.trim(), email: normEmail, passwordHash },
      select: publicShape,
    });
  }

  adminList() {
    return this.prisma.instructor.findMany({ orderBy: { createdAt: 'desc' }, select: publicShape });
  }

  async adminUpdate(id: string, patch: { isActive?: boolean; password?: string }) {
    await this.exists(id);
    const data: { isActive?: boolean; passwordHash?: string } = {};
    if (typeof patch.isActive === 'boolean') data.isActive = patch.isActive;
    if (patch.password) data.passwordHash = await argon2.hash(patch.password);
    return this.prisma.instructor.update({ where: { id }, data, select: publicShape });
  }

  private async exists(id: string) {
    const i = await this.prisma.instructor.findUnique({ where: { id }, select: { id: true } });
    if (!i) throw new NotFoundException('Instructor not found.');
  }
}
