/**
 * Canonical CRM screen keys — mirrors the frontend `ScreenKey` union
 * (src/types.ts). Used to validate `allowedScreens` on the User and by the
 * ScreensGuard / @RequireScreens decorator. Keep in sync with the frontend list.
 */
export const SCREEN_KEYS = [
  'overview',
  'enquiries',
  'leads',
  'pipeline',
  'tasks',
  'calls',
  'programs',
  'reports',
  'customers',
  'settings',
  'veda',
  'livechat',
  'instructors',
] as const;

export type ScreenKey = (typeof SCREEN_KEYS)[number];

export function isScreenKey(value: unknown): value is ScreenKey {
  return typeof value === 'string' && (SCREEN_KEYS as readonly string[]).includes(value);
}
