import { useCallback, useEffect, useState } from 'react';
import { api, currentUserFromToken } from './client';
import type { ScreenKey } from '../types';

export type Role = 'ADMIN' | 'RELATIONSHIP' | 'MARKETING' | 'OPERATIONS';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ManageUser extends ApiUser {
  isActive: boolean;
  allowedScreens: ScreenKey[];
}

/** The signed-in user's own identity + fresh screen access (GET /users/me). */
export interface MeUser extends ManageUser {}

export const ROLES: { key: Role; label: string }[] = [
  { key: 'ADMIN', label: 'Founder · admin' },
  { key: 'RELATIONSHIP', label: 'Relationship manager' },
  { key: 'MARKETING', label: 'Marketing manager' },
  { key: 'OPERATIONS', label: 'Operations manager' },
];
export const ROLE_LABEL: Record<Role, string> = Object.fromEntries(ROLES.map((r) => [r.key, r.label])) as Record<Role, string>;

export interface NewUser { email: string; name: string; role: Role; password: string; allowedScreens?: ScreenKey[] }

export const usersApi = {
  me: () => api.get<MeUser>('/users/me'),
  list: () => api.get<ApiUser[]>('/users'),
  manage: () => api.get<ManageUser[]>('/users/manage'),
  create: (body: NewUser) => api.post<ManageUser>('/users', body),
  updateRole: (id: string, role: Role) => api.patch<ManageUser>(`/users/${id}/role`, { role }),
  setActive: (id: string, isActive: boolean) => api.patch<ManageUser>(`/users/${id}/active`, { isActive }),
  setScreens: (id: string, allowedScreens: ScreenKey[]) => api.patch<ManageUser>(`/users/${id}/screens`, { allowedScreens }),
};

/** Current user's role (decoded from the access token) — gates admin-only UI. */
export const currentRole = (): Role | null => (currentUserFromToken()?.role as Role) ?? null;
export const isAdmin = (): boolean => currentRole() === 'ADMIN';

/** Active users for dropdowns. */
export function useUsers() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  useEffect(() => {
    let alive = true;
    usersApi.list().then((u) => { if (alive) setUsers(u); }).catch(() => { /* empty */ });
    return () => { alive = false; };
  }, []);
  return users;
}

/** Full team incl. inactive — admin management. */
export function useManageUsers() {
  const [users, setUsers] = useState<ManageUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    usersApi.manage().then(setUsers).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load team.'));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { users, error, reload };
}
