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

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('sw_refresh');
  try {
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } catch {
    // best-effort; clear locally regardless
  }
  clearTokens();
}
