/* API client for the public participant experience (separate from the staff CRM
 * client). Stores its own token under sw_live_token so it never collides with
 * staff auth. */

import type { ChatMessage, ClassMode, PollView, Roles } from './roomTypes';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'sw_live_token';

export function liveToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setLiveToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearLiveToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class LiveApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(liveToken() ? { Authorization: `Bearer ${liveToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new LiveApiError(0, 'Could not reach the server. Check your connection.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || 'Something went wrong.';
    throw new LiveApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return data as T;
}

export interface Participant {
  id: string;
  email: string;
  name: string;
}
export interface ParticipantSession {
  token: string;
  participant: Participant;
}

export type ClassStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';
export interface JoinableClass {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ClassStatus;
  mode: ClassMode;
  scheduledAt: string | null;
  startedAt: string | null;
}
export interface JoinInfo {
  classId: string;
  title: string;
  mode: ClassMode;
  role: 'guest';
  videoEnabled: boolean;
  roomId: string | null;
  token: string | null;
  roles: Roles;
}
/** Approval-gated class: the student is in the waiting room (client polls join). */
export interface WaitingInfo {
  waiting: true;
  status: 'PENDING' | 'DENIED';
  classId: string;
  title: string;
}
export type JoinResult = JoinInfo | WaitingInfo;
export const isWaiting = (r: JoinResult): r is WaitingInfo => (r as WaitingInfo).waiting === true;

export const liveApi = {
  signup: (email: string, name: string, password: string) =>
    req<ParticipantSession>('POST', '/participant/auth/signup', { email, name, password }),
  login: (email: string, password: string) =>
    req<ParticipantSession>('POST', '/participant/auth/login', { email, password }),
  me: () => req<Participant>('GET', '/participant/auth/me'),
  joinable: () => req<JoinableClass[]>('GET', '/liveclass/joinable'),
  join: (slug: string) => req<JoinResult>('POST', `/liveclass/${slug}/join`),
  // in-room (learner) — classId comes from the join response
  listMessages: (classId: string) => req<ChatMessage[]>('GET', `/liveclass/${classId}/messages`),
  postMessage: (classId: string, body: string) => req<ChatMessage>('POST', `/liveclass/${classId}/messages`, { body }),
  getPoll: (classId: string) => req<PollView | null>('GET', `/liveclass/${classId}/poll`),
  vote: (classId: string, optionId: string) => req<PollView>('POST', `/liveclass/${classId}/poll/vote`, { optionId }),
  getStatus: (classId: string) => req<{ status: ClassStatus }>('GET', `/liveclass/${classId}/status`),
};
