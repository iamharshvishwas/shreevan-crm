import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

/* ---------- Backend enums (uppercase) + display ---------- */

export type Channel =
  | 'INSTAGRAM' | 'FACEBOOK' | 'WHATSAPP' | 'EMAIL'
  | 'WEBSITE_FORM' | 'WEBSITE_CHAT' | 'PHONE' | 'WALKIN' | 'REFERRAL' | 'GOOGLE_BUSINESS';

export type EnquiryStatus = 'NEEDS_REPLY' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'SPAM';
export type Priority = 'HIGH' | 'NORMAL' | 'LOW';
export type SlaState = 'none' | 'on_track' | 'warning' | 'breached' | 'completed' | 'paused';
export type PrimaryView = 'needs_reply' | 'unassigned' | 'waiting_for_customer' | 'sla_breached' | 'all';

export const PRIMARY_VIEWS: { key: PrimaryView; label: string }[] = [
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'waiting_for_customer', label: 'Waiting for customer' },
  { key: 'sla_breached', label: 'SLA breached' },
  { key: 'all', label: 'All enquiries' },
];

export const CHANNEL_LABEL: Record<Channel, string> = {
  INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', WHATSAPP: 'WhatsApp', EMAIL: 'Email',
  WEBSITE_FORM: 'Website form', WEBSITE_CHAT: 'Website chat', PHONE: 'Phone', WALKIN: 'Walk-in',
  REFERRAL: 'Referral', GOOGLE_BUSINESS: 'Google Business',
};

export const STATUS_LABEL: Record<EnquiryStatus, string> = {
  NEEDS_REPLY: 'Needs reply', WAITING_FOR_CUSTOMER: 'Waiting for customer', RESOLVED: 'Resolved', SPAM: 'Spam',
};

export const STATUS_STYLE: Record<EnquiryStatus, { bg: string; fg: string }> = {
  NEEDS_REPLY: { bg: '#f0dfd7', fg: '#a95f45' },
  WAITING_FOR_CUSTOMER: { bg: '#e8f0ec', fg: '#5e6863' },
  RESOLVED: { bg: '#e4efe8', fg: '#2e6a4d' },
  SPAM: { bg: '#f2e0e0', fg: '#9e3f3f' },
};

export const SLA_STYLE: Record<SlaState, { bg: string; fg: string; label: string }> = {
  none: { bg: '#ece4d3', fg: '#5e6863', label: '—' },
  on_track: { bg: '#e8f0ec', fg: '#315a49', label: 'On track' },
  warning: { bg: '#f1e8d3', fg: '#806019', label: 'SLA due soon' },
  breached: { bg: '#f2e0e0', fg: '#9e3f3f', label: 'SLA breached' },
  completed: { bg: '#e4efe8', fg: '#2e6a4d', label: 'First response met' },
  paused: { bg: '#ece4d3', fg: '#5e6863', label: 'SLA paused' },
};

/* ---------- Types ---------- */

export interface EnquiryListItem {
  id: string;
  status: EnquiryStatus;
  priority: Priority;
  channel: Channel;
  firstTouchSource: Channel;
  ownerId: string | null;
  firstRespondedAt: string | null;
  lastInboundAt: string;
  lastMessageAt: string;
  programInterest: string | null;
  nextAction: string | null;
  leadId: string | null;
  contact: { name: string; country: string | null };
  _count?: { conversations: number };
}

export interface EnquiryMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  channel: Channel;
  authorName: string;
  body: string;
  delivery: string;
  occurredAt: string;
}

export interface EnquiryDetail extends EnquiryListItem {
  expectedValueAmount: number | null;
  expectedValueCurrency: 'USD' | 'INR' | null;
  nextActionDate: string | null;
  contact: {
    name: string; country: string | null; timezone: string | null; language: string | null;
    preferredContact: string | null; firstTouchSource: Channel;
    identities: { id: string; channel: Channel; handle: string; verified: boolean }[];
  };
  owner: { id: string; name: string } | null;
  tags: { id: string; tag: string }[];
  notes: { id: string; authorName: string; body: string; createdAt: string }[];
  conversations: { id: string; channel: Channel; subject: string | null; messages: EnquiryMessage[] }[];
  lead: { id: string } | null;
  sla: { state: SlaState; dueAt: string | null };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListParams {
  view: PrimaryView;
  channel?: Channel | 'all';
  ownerId?: string | 'all';
  priority?: Priority | 'all';
  q?: string;
  page?: number;
}

/* ---------- Calls ---------- */

function qs(params: ListParams): string {
  const u = new URLSearchParams();
  u.set('view', params.view);
  if (params.channel && params.channel !== 'all') u.set('channel', params.channel);
  if (params.ownerId && params.ownerId !== 'all') u.set('ownerId', params.ownerId);
  if (params.priority && params.priority !== 'all') u.set('priority', params.priority);
  if (params.q?.trim()) u.set('q', params.q.trim());
  if (params.page) u.set('page', String(params.page));
  u.set('pageSize', '50');
  return u.toString();
}

export interface ManualEnquiryBody {
  name: string;
  channel: Channel;
  country?: string;
  email?: string;
  phone?: string;
  message: string;
  programInterest?: string;
}

export const enquiriesApi = {
  manual: (body: ManualEnquiryBody) => api.post<{ status: string; enquiryId?: string }>('/enquiries/manual', body),
  list: (params: ListParams) => api.get<Paginated<EnquiryListItem>>(`/enquiries?${qs(params)}`),
  get: (id: string) => api.get<EnquiryDetail>(`/enquiries/${id}`),
  assign: (id: string, ownerId: string) => api.post(`/enquiries/${id}/assign`, { ownerId }),
  setStatus: (id: string, status: EnquiryStatus) => api.post(`/enquiries/${id}/status`, { status }),
  addNote: (id: string, body: string) => api.post(`/enquiries/${id}/notes`, { body }),
  respond: (id: string, body: string) => api.post<{ delivery: string; detail: string }>(`/enquiries/${id}/responses`, { body }),
  resolve: (id: string) => api.post(`/enquiries/${id}/resolve`),
  createTask: (id: string, title: string, dueAt?: string) => api.post(`/enquiries/${id}/tasks`, { title, dueAt }),
  scheduleCall: (id: string, scheduledAt: string, timezone: string, prepNotes?: string) =>
    api.post(`/enquiries/${id}/discovery-calls`, { scheduledAt, timezone, prepNotes }),
  duplicateLeads: (id: string) => api.get<{ leads: { id: string; programInterest: string | null }[] }>(`/enquiries/${id}/duplicate-leads`),
  convert: (id: string, body: ConvertBody) => api.post<{ id: string }>(`/enquiries/${id}/convert-to-lead`, body),
};

export interface ConvertBody {
  ownerId?: string;
  nextAction: string;
  nextActionDate: string;
  programInterest?: string;
  temperature?: 'HOT' | 'WARM' | 'COLD';
  expectedValueAmount?: number;
  expectedValueCurrency?: 'USD' | 'INR';
  linkExistingLeadId?: string;
}

/* ---------- Formatters (real "now", IST-first) ---------- */

const hm = (utc: string, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(utc));

const tzAbbr = (utc: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone: tz, hour: '2-digit' })
    .formatToParts(new Date(utc)).find((p) => p.type === 'timeZoneName')?.value ?? '';

export function istFirst(utc: string, tz?: string | null): string {
  const ist = `${hm(utc, 'Asia/Kolkata')} IST`;
  if (!tz || tz === 'Asia/Kolkata') return ist;
  return `${ist} · ${hm(utc, tz)} ${tzAbbr(utc, tz)}`;
}

export function dayLabel(utc: string): string {
  const d = new Date(utc);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);
}

export const relTime = (utc: string) => `${dayLabel(utc)} · ${hm(utc, 'Asia/Kolkata')} IST`;

export function formatMoney(amount: number | null, currency: 'USD' | 'INR' | null): string {
  if (amount == null || !currency) return '—';
  const major = amount / 100;
  return currency === 'INR' ? `₹${major.toLocaleString('en-IN')}` : `$${major.toLocaleString('en-US')}`;
}

/* ---------- Hooks ---------- */

export function useEnquiryList(params: ListParams) {
  const [data, setData] = useState<Paginated<EnquiryListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return enquiriesApi
      .list(params)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load enquiries.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useEnquiry(id: string | null) {
  const [data, setData] = useState<EnquiryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) { setData(null); return Promise.resolve(); }
    setLoading(true);
    setError(null);
    return enquiriesApi
      .get(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load enquiry.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

/** Lightweight "needs action" count for the sidebar badge. */
export function useActionableCount(): { count: number; reload: () => void } {
  const [count, setCount] = useState(0);
  const reload = useCallback(() => {
    enquiriesApi
      .list({ view: 'needs_reply', page: 1 })
      .then((r) => setCount(r.total))
      .catch(() => { /* keep last value */ });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { count, reload };
}
