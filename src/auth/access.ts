import { SCREENS, type ScreenKey } from '../types';
import type { SessionUser } from './useAuth';

/**
 * Frontend screen-visibility rules. Cosmetic only — the backend ScreensGuard is
 * the real enforcement (see server/src/common/auth/screens.guard.ts). ADMIN sees
 * everything; `settings` is always available (self-service password/2FA);
 * everything else follows the user's per-user allowedScreens.
 */
export function canSeeScreen(user: SessionUser | null, key: ScreenKey): boolean {
  if (key === 'settings') return true;
  if (user?.role === 'ADMIN') return true;
  return (user?.allowedScreens ?? []).includes(key);
}

/** True once we know the user's access (admin from token, or /users/me resolved). */
export function accessResolved(user: SessionUser | null): boolean {
  return user?.role === 'ADMIN' || Array.isArray(user?.allowedScreens);
}

/** The screen a user should land on — first visible in canonical SCREENS order. */
export function firstAllowedScreen(user: SessionUser | null): ScreenKey {
  const visible = SCREENS.find((s) => s.key !== 'settings' && canSeeScreen(user, s.key));
  return visible?.key ?? 'settings';
}
