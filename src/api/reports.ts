import { useEffect, useState } from 'react';
import { api } from './client';

export interface Tally { label: string; count: number }

export interface Analytics {
  conversion: {
    enquiries: number;
    leads: number;
    bookings: number;
    enquiryToLeadRate: number;
    leadToBookingRate: number;
    avgFirstResponseMins: number | null;
  };
  byCountry: Tally[];
  byProgram: Tally[];
  byChannel: Tally[];
  lostReasons: Tally[];
  revenue: { expected: { USD: number; INR: number }; confirmed: { USD: number; INR: number } };
}

export function useAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  function reload() {
    setLoading(true); setError(null);
    api.get<Analytics>('/reports/analytics').then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);
  return { data, loading, error, reload };
}

export function formatMins(mins: number | null): string {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
