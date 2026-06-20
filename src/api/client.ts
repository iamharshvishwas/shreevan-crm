/* Typed fetch client for the Shreevan CRM API.
 * - Base URL from VITE_API_URL (defaults to the local backend).
 * - Attaches the Bearer access token; transparently refreshes once on 401.
 * - Tokens persist in localStorage so login survives a refresh.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

const ACCESS_KEY = 'sw_access';
const REFRESH_KEY = 'sw_refresh';

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasSession(): boolean {
  return !!accessToken;
}

/** Decode the (unverified) JWT payload for display — never trusted for access. */
export function currentUserFromToken(): { id: string; email: string; role: string } | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return { id: json.sub, email: json.email, role: json.role };
  } catch {
    return null;
  }
}

export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: ApiErrorShape | null) {
    super(body?.message ?? `Request failed (${status})`);
  }
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { statusCode: 0, code: 'NETWORK', message: 'Could not reach the API. Is the backend running?' });
  }

  if (res.status === 401 && retry && (await refresh())) {
    return request<T>(method, path, body, false);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { BASE as API_BASE };
