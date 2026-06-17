import { useState } from 'react';
import { currentUserFromToken, hasSession } from '../api/client';
import { login as apiLogin, logout as apiLogout } from '../api/auth';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(hasSession);
  const [user, setUser] = useState<SessionUser | null>(currentUserFromToken);

  async function login(email: string, password: string): Promise<void> {
    await apiLogin(email, password);
    setUser(currentUserFromToken());
    setAuthed(true);
  }

  async function logout(): Promise<void> {
    await apiLogout();
    setUser(null);
    setAuthed(false);
  }

  return { authed, user, login, logout };
}

export type AuthStore = ReturnType<typeof useAuth>;
