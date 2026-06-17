import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const reload = useCallback(() => {
    api.get<NotificationItem[]>('/notifications').then(setItems).catch(() => { /* keep */ });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const unread = items.filter((n) => !n.readAt).length;
  const markAllRead = useCallback(async () => {
    try { await api.post('/notifications/read-all'); setItems((xs) => xs.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))); }
    catch { /* ignore */ }
  }, []);
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
