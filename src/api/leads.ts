import { useCallback, useEffect, useState } from 'react';
import { api } from './client';
import { useLiveResource } from './live';
import type { Channel, Paginated } from './enquiries';
import { CHANNEL_LABEL } from './enquiries';

export type Temperature = 'HOT' | 'WARM' | 'COLD';
export type Currency = 'USD' | 'INR';
export type LeadView = 'active' | 'hot' | 'no_next_action' | 'payment_pending' | 'closed_lost' | 'all';

export const LEAD_VIEWS: { key: LeadView; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'hot', label: 'Hot' },
  { key: 'no_next_action', label: 'No next action' },
  { key: 'payment_pending', label: 'Payment pending' },
  { key: 'closed_lost', label: 'Closed lost' },
  { key: 'all', label: 'All leads' },
];

export const TEMP_STYLE: Record<Temperature, { bg: string; fg: string; label: string }> = {
  HOT: { bg: '#f0dfd7', fg: '#a95f45', label: 'Hot' },
  WARM: { bg: '#f1e8d3', fg: '#806019', label: 'Warm' },
  COLD: { bg: '#e0ebef', fg: '#2f6680', label: 'Cold' },
};

export const STAGE_STYLE: Record<string, { bg: string; fg: string }> = {
  new_enquiry: { bg: '#e0ebef', fg: '#2f6680' },
  first_response: { bg: '#e8f0ec', fg: '#315a49' },
  discovery_scheduled: { bg: '#efe3ca', fg: '#806019' },
  discovery_completed: { bg: '#dde6df', fg: '#315a49' },
  qualified: { bg: '#f0dfd7', fg: '#a95f45' },
  application: { bg: '#dbe8eb', fg: '#2d5f6b' },
  offer_sent: { bg: '#efe3ca', fg: '#806019' },
  payment_pending: { bg: '#f1e8d3', fg: '#806019' },
  confirmed: { bg: '#e4efe8', fg: '#2e6a4d' },
  closed_lost: { bg: '#f2e0e0', fg: '#9e3f3f' },
};
export const stageStyle = (key: string) => STAGE_STYLE[key] ?? { bg: '#ece4d3', fg: '#5e6863' };

export interface Stage {
  id: string; key: string; label: string; order: number;
  isTerminalWon: boolean; isTerminalLost: boolean;
}

export interface LeadListItem {
  id: string;
  stageId: string;
  temperature: Temperature;
  ownerId: string | null;
  programInterest: string | null;
  expectedValueAmount: number | null;
  expectedValueCurrency: Currency | null;
  nextAction: string | null;
  nextActionDate: string | null;
  firstTouchSource: Channel;
  confirmedAt: string | null;
  closedLostAt: string | null;
  contact: { name: string; country: string | null };
  stage: Stage;
  owner: { name: string } | null;
}

export interface BoardCard {
  id: string; name: string; country: string | null; timezone: string | null;
  programInterest: string | null; temperature: Temperature; ownerId: string | null;
  expectedValueAmount: number | null; expectedValueCurrency: Currency | null;
  nextAction: string | null; nextActionDate: string | null; firstTouchSource: Channel;
}
export interface BoardColumn extends Stage {
  count: number; sums: Record<Currency, number>; leads: BoardCard[];
}

export interface LeadDetail extends LeadListItem {
  participants: number;
  decisionDate: string | null;
  healthScreening: string | null;
  eligibility: string | null;
  preferredDates: string | null;
  contact: {
    name: string; country: string | null; timezone: string | null; language: string | null;
    preferredContact: string | null;
    identities: { id: string; channel: Channel; handle: string; verified: boolean }[];
  };
  owner: { id: string; name: string } | null;
  lostReason: { key: string; label: string } | null;
  stageHistory: { id: string; at: string; fromStage: Stage | null; toStage: Stage }[];
  activities: { id: string; type: string; title: string; body: string | null; at: string }[];
  booking: { id: string; paymentStatus: string; customer: { onboardingStatus: string } | null } | null;
}

export { CHANNEL_LABEL };

/* ---------- Calls ---------- */

export const leadsApi = {
  list: (view: LeadView, ownerId?: string, q?: string) => {
    const u = new URLSearchParams({ view, pageSize: '100' });
    if (ownerId && ownerId !== 'all') u.set('ownerId', ownerId);
    if (q?.trim()) u.set('q', q.trim());
    return api.get<Paginated<LeadListItem>>(`/leads?${u.toString()}`);
  },
  get: (id: string) => api.get<LeadDetail>(`/leads/${id}`),
  board: () => api.get<BoardColumn[]>('/pipeline/board'),
  stages: () => api.get<Stage[]>('/pipeline/stages'),
  lostReasons: () => api.get<{ key: string; label: string }[]>('/pipeline/lost-reasons'),
  moveStage: (id: string, toStageKey: string) => api.post(`/leads/${id}/move-stage`, { toStageKey }),
  setNextAction: (id: string, nextAction: string, nextActionDate: string, ownerId?: string) =>
    api.post(`/leads/${id}/next-action`, { nextAction, nextActionDate, ownerId }),
  confirmBooking: (id: string) => api.post(`/leads/${id}/confirm-booking`, {}),
  closeLost: (id: string, reasonKey: string) => api.post(`/leads/${id}/close-lost`, { reasonKey }),
};

/* ---------- Hooks ---------- */

export function useLeadsList(view: LeadView, ownerId: string, q: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useLiveResource(() => leadsApi.list(view, ownerId, q), [`${view}|${ownerId}|${q}`]);
}

export function usePipelineBoard() {
  return useLiveResource(() => leadsApi.board(), []);
}

export function useLead(id: string | null) {
  const [data, setData] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!id) { setData(null); return Promise.resolve(); }
    setLoading(true); setError(null);
    return leadsApi.get(id).then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Lead not found.'))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useStages() {
  const [stages, setStages] = useState<Stage[]>([]);
  useEffect(() => { leadsApi.stages().then(setStages).catch(() => setStages([])); }, []);
  return stages;
}
