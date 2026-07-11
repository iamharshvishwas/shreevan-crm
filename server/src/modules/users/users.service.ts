import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.errors';

const SAFE = { id: true, name: true, email: true, role: true, title: true, isActive: true, allowedScreens: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Active users for assignment dropdowns (no secrets). */
  list() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Full team incl. inactive — admin management view. */
  listAll() {
    return this.prisma.user.findMany({ select: SAFE, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  /** The signed-in user's own identity + fresh screen access. */
  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE });
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async create(
    input: { email: string; name: string; password: string; role: Role; title?: string; allowedScreens?: string[] },
    actorId?: string,
  ) {
    const existing = await this.findByEmail(input.email);
    if (existing) throw new ConflictError('EMAIL_TAKEN', 'A user with this email already exists.', { email: ['Email already in use.'] });
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        title: input.title ?? '',
        allowedScreens: input.allowedScreens ?? [],
        passwordHash: await argon2.hash(input.password),
      },
      select: SAFE,
    });
    await this.audit(actorId, 'USER_CREATED', user.id, { role: input.role });
    return user;
  }

  async setScreens(id: string, allowedScreens: string[], actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    const updated = await this.prisma.user.update({ where: { id }, data: { allowedScreens }, select: SAFE });
    await this.audit(actorId, 'USER_SCREENS_CHANGED', id, { from: user.allowedScreens, to: allowedScreens });
    return updated;
  }

  /** Admin sets a user's free-text display title (e.g. "Relationship Manager"). */
  async setTitle(id: string, title: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    const updated = await this.prisma.user.update({ where: { id }, data: { title }, select: SAFE });
    await this.audit(actorId, 'USER_TITLE_CHANGED', id, { from: user.title, to: title });
    return updated;
  }

  async updateRole(id: string, role: Role, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    if (user.role === Role.ADMIN && role !== Role.ADMIN && (await this.isLastAdmin(id))) {
      throw new ConflictError('LAST_ADMIN', 'You cannot remove the last admin. Promote another admin first.');
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { role }, select: SAFE });
    await this.audit(actorId, 'USER_ROLE_CHANGED', id, { from: user.role, to: role });
    return updated;
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    if (id === actorId && !isActive) throw new ForbiddenError('You cannot deactivate your own account.');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    if (!isActive && user.role === Role.ADMIN && (await this.isLastAdmin(id))) {
      throw new ConflictError('LAST_ADMIN', 'You cannot deactivate the last admin.');
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { isActive }, select: SAFE });
    await this.audit(actorId, isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', id, {});
    if (!isActive) await this.prisma.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return updated;
  }

  /** Permanently removes a deactivated user. Must be deactivated first (defense
   *  in depth on top of the frontend gate) — prevents removing someone still
   *  mid-shift by mistake. Owned enquiries/leads/tasks/calls survive with their
   *  owner cleared (schema FKs are optional + SetNull); audit/history rows keep
   *  the stale actor id, same as any departed employee's historical trail. */
  async remove(id: string, actorId: string) {
    if (id === actorId) throw new ForbiddenError('You cannot remove your own account.');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    if (user.isActive) throw new ConflictError('USER_ACTIVE', 'Deactivate this user before removing them.');
    await this.prisma.user.delete({ where: { id } });
    await this.audit(actorId, 'USER_REMOVED', id, { email: user.email, name: user.name, role: user.role });
    return { ok: true };
  }

  /** Admin sets a user's password (forgot-password recovery for a small team).
   *  Clears any lockout and revokes the user's sessions so the old password is dead. */
  async adminSetPassword(id: string, password: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.prisma.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit(actorId, 'USER_PASSWORD_RESET', id, {});
    return { ok: true };
  }

  /** True when no other active admin exists besides `excludeId`. */
  private async isLastAdmin(excludeId: string): Promise<boolean> {
    const others = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true, id: { not: excludeId } } });
    return others === 0;
  }

  private audit(actorId: string | undefined, action: string, entityId: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'User', entityId, metadata } });
  }
}
