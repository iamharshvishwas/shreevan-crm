import { useEffect, useState } from 'react';
import { currentUserFromToken, hasSession, onAuthExpired } from '../api/client';
import { login as apiLogin, logout as apiLogout } from '../api/auth';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(hasSession);
  const [user, setUser] = useState<SessionUser | null>(currentUserFromToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  // When the API client can't refresh a dead session, drop to the login screen.
  useEffect(() => onAuthExpired(() => {
    setAuthed(false);
    setUser(null);
    setSessionExpired(true);
  }), []);

  async function login(email: string, password: string): Promise<void> {
    await apiLogin(email, password);
    setUser(currentUserFromToken());
    setSessionExpired(false);
    setAuthed(true);
  }

  async function logout(): Promise<void> {
    await apiLogout();
    setUser(null);
    setSessionExpired(false);
    setAuthed(false);
  }

  return { authed, user, sessionExpired, login, logout };
}

export type AuthStore = ReturnType<typeof useAuth>;
