/* API client for the instructor host area (/teach). Separate token from staff
 * and learners — stored under sw_teach_token. */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'sw_teach_token';

export const teachToken = () => localStorage.getItem(TOKEN_KEY);
export const setTeachToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearTeachToken = () => localStorage.removeItem(TOKEN_KEY);

export class TeachApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(teachToken() ? { Authorization: `Bearer ${teachToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new TeachApiError(0, 'Could not reach the server. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || 'Something went wrong.';
    throw new TeachApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return data as T;
}

export interface Instructor { id: string; email: string; name: string }
export interface InstructorSession { token: string; instructor: Instructor }

export type ClassStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';
export interface HostClass {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ClassStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
}
export interface HostRoomInfo {
  classId: string;
  title: string;
  role: 'host';
  videoEnabled: boolean;
  roomId: string | null;
  token: string | null;
}

export const teachApi = {
  login: (email: string, password: string) => req<InstructorSession>('POST', '/instructor/auth/login', { email, password }),
  me: () => req<Instructor>('GET', '/instructor/auth/me'),
  myClasses: () => req<HostClass[]>('GET', '/liveclass/host'),
  create: (title: string, description?: string) => req<HostClass>('POST', '/liveclass', { title, description }),
  start: (id: string) => req<HostClass>('POST', `/liveclass/${id}/start`),
  end: (id: string) => req<HostClass>('POST', `/liveclass/${id}/end`),
  hostToken: (id: string) => req<HostRoomInfo>('POST', `/liveclass/${id}/host-token`),
};
