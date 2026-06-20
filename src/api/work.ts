import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'done';
export type Priority = 'HIGH' | 'NORMAL' | 'LOW';

export interface Task {
  id: string;
  type: string;
  title: string;
  status: 'OPEN' | 'DONE';
  priority: Priority;
  dueAt: string | null;
  ownerId: string | null;
  leadId: string | null;
  bucket: TaskBucket;
  relatedName: string | null;
}

export const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; label: string }> = {
  HIGH: { bg: '#f0dfd7', fg: '#a95f45', label: 'High' },
  NORMAL: { bg: '#efe3ca', fg: '#806019', label: 'Normal' },
  LOW: { bg: '#e8f0ec', fg: '#315a49', label: 'Low' },
};

export interface DiscoveryCall {
  id: string;
  scheduledAt: string;
  timezone: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  prepNotes: string | null;
  outcome: string | null;
  durationMins: number | null;
  // Veda AI voice-call fields (Phase 3); transcript is health-redacted.
  recordingUrl: string | null;
  summary: string | null;
  transcriptRedacted: string | null;
  externalCallId: string | null;
  contact: { name: string; country: string | null; timezone: string | null };
  owner: { name: string } | null;
  lead: { id: string } | null;
}

export type OnboardingStatus = 'NOT_STARTED' | 'WELCOME_PACK_PENDING' | 'TRAVEL_PENDING' | 'SCREENING_COMPLETED' | 'READY';
export type PaymentStatus = 'PENDING' | 'DEPOSIT' | 'PAID_IN_FULL';

export const ONBOARDING_LABEL: Record<OnboardingStatus, string> = {
  NOT_STARTED: 'Not started',
  WELCOME_PACK_PENDING: 'Welcome pack pending',
  TRAVEL_PENDING: 'Travel details pending',
  SCREENING_COMPLETED: 'Screening completed',
  READY: 'Ready for arrival',
};
export const ONBOARDING_STYLE: Record<OnboardingStatus, { bg: string; fg: string }> = {
  NOT_STARTED: { bg: '#ece4d3', fg: '#5e6863' },
  WELCOME_PACK_PENDING: { bg: '#f1e8d3', fg: '#806019' },
  TRAVEL_PENDING: { bg: '#f1e8d3', fg: '#806019' },
  SCREENING_COMPLETED: { bg: '#e4efe8', fg: '#2e6a4d' },
  READY: { bg: '#e4efe8', fg: '#2e6a4d' },
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending', DEPOSIT: 'Deposit received', PAID_IN_FULL: 'Paid in full',
};

export interface Customer {
  id: string;
  onboardingStatus: OnboardingStatus;
  contact: { name: string; country: string | null; timezone: string | null };
  booking: {
    valueAmount: number;
    valueCurrency: 'USD' | 'INR';
    paymentStatus: PaymentStatus;
    lead: { programInterest: string | null } | null;
    cohort: { startDate: string; program: { name: string } | null } | null;
  } | null;
}

export const tasksApi = {
  list: (ownerId?: string) => api.get<Task[]>(`/tasks${ownerId && ownerId !== 'all' ? `?ownerId=${ownerId}` : ''}`),
  setDone: (id: string, done: boolean) => api.post(`/tasks/${id}/${done ? 'complete' : 'reopen'}`),
};

export const callsApi = {
  list: () => api.get<{ upcoming: DiscoveryCall[]; completed: DiscoveryCall[] }>('/discovery-calls'),
  complete: (id: string, outcome?: string) => api.post(`/discovery-calls/${id}/complete`, { outcome }),
  reschedule: (id: string, scheduledAt: string) => api.post(`/discovery-calls/${id}/reschedule`, { scheduledAt }),
};

export const customersApi = {
  list: () => api.get<Customer[]>('/customers'),
  setOnboarding: (id: string, status: OnboardingStatus) => api.post(`/customers/${id}/onboarding`, { status }),
};

function useResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setLoading(true); setError(null);
    return fetcher().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export const useTasks = (ownerId: string) => {
  const [data, setData] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setLoading(true); setError(null);
    return tasksApi.list(ownerId).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tasks.')).finally(() => setLoading(false));
  }, [ownerId]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
};

export const useCalls = () => useResource(() => callsApi.list());
export const useCustomers = () => useResource(() => customersApi.list());
