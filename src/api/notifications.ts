import { useCallback } from 'react';
import { api } from './client';
import { useLiveResource } from './live';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const { data, reload } = useLiveResource(() => api.get<NotificationItem[]>('/notifications'), [], 20_000);
  const items = data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const markAllRead = useCallback(async () => {
    try { await api.post('/notifications/read-all'); await reload(); }
    catch { /* ignore */ }
  }, [reload]);
  return { items, unread, reload, markAllRead };
}

const TYPE_COLOR: Record<string, string> = {
  SLA_BREACH: 'var(--sw-error)',
  SLA_WARNING: 'var(--sw-warning)',
  ENQUIRY_RECEIVED: 'var(--sw-river-600)',
  ENQUIRY_ASSIGNED: 'var(--sw-river-600)',
  LEAD_CREATED: 'var(--sw-success)',
};
export const notifColor = (type: string) => TYPE_COLOR[type] ?? 'var(--sw-stone-600)';
