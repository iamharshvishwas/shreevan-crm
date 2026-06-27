import { useEffect, useState } from 'react';
import { currentUserFromToken, hasSession, onAuthExpired } from '../api/client';
import { login as apiLogin, logout as apiLogout, verify2faLogin, type LoginOutcome } from '../api/auth';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(hasSession);
  const [user, setUser] = useState<SessionUser | null>(currentUserFromToken);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Set when an admin signs in without 2FA — the app nudges them to enrol.
  const [setup2faRequired, setSetup2faRequired] = useState(false);

  // When the API client can't refresh a dead session, drop to the login screen.
  useEffect(() => onAuthExpired(() => {
    setAuthed(false);
    setUser(null);
    setSessionExpired(true);
  }), []);

  function activateSession(setupRequired: boolean) {
    setUser(currentUserFromToken());
    setSessionExpired(false);
    setSetup2faRequired(setupRequired);
    setAuthed(true);
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

  return { authed, user, sessionExpired, setup2faRequired, login, verify2fa, logout, clearSetupNudge };
}

export type AuthStore = ReturnType<typeof useAuth>;
