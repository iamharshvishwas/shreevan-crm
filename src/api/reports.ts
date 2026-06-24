import { api } from './client';
import { useLiveResource } from './live';

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
  return useLiveResource(() => api.get<Analytics>('/reports/analytics'), [], 30_000);
}

export function formatMins(mins: number | null): string {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
