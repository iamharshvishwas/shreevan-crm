/** Top-level navigation screens. Domain types now live in `src/api/*`. */
export type ScreenKey =
  | 'overview' | 'enquiries' | 'leads' | 'pipeline' | 'tasks' | 'calls'
  | 'programs' | 'reports' | 'customers' | 'settings' | 'veda' | 'livechat'
  | 'instructors';

/** Canonical screen list with labels — single source for the sidebar and the
 *  admin per-user access editor. Keep in sync with the backend SCREEN_KEYS
 *  (server/src/common/auth/screens.ts). */
export const SCREENS: { key: ScreenKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'livechat', label: 'Live Chat' },
  { key: 'leads', label: 'Leads' },
  { key: 'pipeline', label: 'Booking Pipeline' },
  { key: 'tasks', label: 'Tasks & Follow-ups' },
  { key: 'calls', label: 'Discovery Calls' },
  { key: 'programs', label: 'Programs' },
  { key: 'reports', label: 'Reports' },
  { key: 'customers', label: 'Confirmed Customers' },
  { key: 'veda', label: 'Veda — AI Agent' },
  { key: 'instructors', label: 'Instructors' },
  { key: 'settings', label: 'Settings' },
];
