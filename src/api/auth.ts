import { api, clearTokens, setTokens } from './client';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await api.post<TokensResponse>('/auth/login', { email, password });
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
