import { useCallback, useEffect, useState } from 'react';
import { currentUserFromToken, hasSession, onAuthExpired } from '../api/client';
import { login as apiLogin, logout as apiLogout, verify2faLogin, type LoginOutcome } from '../api/auth';
import { usersApi } from '../api/users';
import type { ScreenKey } from '../types';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  /** Per-user screen access, fetched fresh from /users/me. Undefined until the
   *  fetch resolves; empty array = no screens (non-admin with nothing granted). */
  allowedScreens?: ScreenKey[];
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(hasSession);
  const [user, setUser] = useState<SessionUser | null>(currentUserFromToken);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Set when an admin signs in without 2FA — the app nudges them to enrol.
  const [setup2faRequired, setSetup2faRequired] = useState(false);

  // Pull fresh screen access (and canonical role/name) from the server. The
  // decoded JWT only carries {id,email,role} and can be stale for access; this
  // is the source of truth for what the user may see.
  const refreshAccess = useCallback(async () => {
    try {
      const me = await usersApi.me();
      setUser((prev) => ({ ...(prev ?? { id: me.id, email: me.email }), ...me, allowedScreens: me.allowedScreens }));
    } catch {
      /* keep the token-derived user; gating falls back to role-only */
    }
  }, []);

  // When the API client can't refresh a dead session, drop to the login screen.
  useEffect(() => onAuthExpired(() => {
    setAuthed(false);
    setUser(null);
    setSessionExpired(true);
  }), []);

  // On first load with an existing session, hydrate screen access.
  useEffect(() => {
    if (hasSession()) void refreshAccess();
  }, [refreshAccess]);

  function activateSession(setupRequired: boolean) {
    setUser(currentUserFromToken());
    setSessionExpired(false);
    setSetup2faRequired(setupRequired);
    setAuthed(true);
    void refreshAccess();
  }

  /** Returns 'ok' (signed in) or '2fa' (caller must collect a code → verify2fa). */
  async function login(email: string, password: string): Promise<LoginOutcome> {
    const outcome = await apiLogin(email, password);
    if (outcome.status === 'ok') activateSession(outcome.setup2faRequired);
    return outcome;
  }

  /** Second step of a 2FA login. */
  async function verify2fa(challengeToken: string, code: string): Promise<void> {
    await verify2faLogin(challengeToken, code);
    activateSession(false);
  }

  async function logout(): Promise<void> {
    await apiLogout();
    setUser(null);
    setSessionExpired(false);
    setSetup2faRequired(false);
    setAuthed(false);
  }

  // Lets the Settings screen clear the nudge once the user enrols (or dismisses).
  function clearSetupNudge() {
    setSetup2faRequired(false);
  }

  return { authed, user, sessionExpired, setup2faRequired, login, verify2fa, logout, clearSetupNudge, refreshAccess };
}

export type AuthStore = ReturnType<typeof useAuth>;
