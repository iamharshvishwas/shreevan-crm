import { api, clearTokens, setTokens } from './client';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  setup2faRequired?: boolean;
}

interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

/** Result of a login attempt: signed in, or a pending 2FA challenge. */
export type LoginOutcome =
  | { status: 'ok'; setup2faRequired: boolean }
  | { status: '2fa'; challengeToken: string };

function isChallenge(r: TokensResponse | TwoFactorChallenge): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).twoFactorRequired === true;
}

export async function login(email: string, password: string): Promise<LoginOutcome> {
  const res = await api.post<TokensResponse | TwoFactorChallenge>('/auth/login', { email, password });
  if (isChallenge(res)) return { status: '2fa', challengeToken: res.challengeToken };
  setTokens(res.accessToken, res.refreshToken);
  return { status: 'ok', setup2faRequired: !!res.setup2faRequired };
}

/** Second step of a 2FA login — exchange the challenge token + code for tokens. */
export async function verify2faLogin(challengeToken: string, code: string): Promise<void> {
  const tokens = await api.post<TokensResponse>('/auth/2fa/verify', { challengeToken, code });
  setTokens(tokens.accessToken, tokens.refreshToken);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  // Backend revokes old sessions and returns a fresh pair — store it so the
  // current device stays logged in.
  const tokens = await api.patch<TokensResponse>('/auth/password', { currentPassword, newPassword });
  setTokens(tokens.accessToken, tokens.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('sw_refresh');
  try {
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } catch {
    // best-effort; clear locally regardless
  }
  clearTokens();
}

/* ---------------- Two-factor management (signed-in user) ---------------- */

export interface TwoFactorStatus {
  enabled: boolean;
  setup2faRequired: boolean;
}

export interface TwoFactorSetup {
  otpauthUri: string;
  qrDataUrl: string;
  secret: string;
}

export function get2faStatus(): Promise<TwoFactorStatus> {
  return api.get<TwoFactorStatus>('/auth/2fa/status');
}

export function setup2fa(): Promise<TwoFactorSetup> {
  return api.post<TwoFactorSetup>('/auth/2fa/setup');
}

export function enable2fa(code: string): Promise<{ backupCodes: string[] }> {
  return api.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code });
}

export function disable2fa(code: string): Promise<{ ok: true }> {
  return api.post<{ ok: true }>('/auth/2fa/disable', { code });
}
