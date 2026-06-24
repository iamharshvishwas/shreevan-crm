import { api } from './client';
import { useLiveResource } from './live';

export interface OverviewResponse {
  metrics: {
    newEnquiries: number;
    needsReply: number;
    unassigned: number;
    slaBreached: number;
    discoveryCallsScheduled: number;
    qualifiedOpportunities: number;
    confirmedBookings: number;
    expectedRevenue: { USD: number; INR: number }; // integer minor units
  };
  recentActivity: { id: string; action: string; entityType: string; at: string }[];
}

export function useOverview() {
  return useLiveResource(() => api.get<OverviewResponse>('/reports/overview'), []);
}

/** Format integer minor units → a compact currency string ($49.0K / ₹7.5L). */
export function formatMinor(amountMinor: number, currency: 'USD' | 'INR'): string {
  const major = amountMinor / 100;
  if (currency === 'INR') {
    if (major >= 100000) return `₹${(major / 100000).toFixed(1)}L`;
    return `₹${major.toLocaleString('en-IN')}`;
  }
  if (major >= 1000) return `$${(major / 1000).toFixed(1)}K`;
  return `$${major.toLocaleString('en-US')}`;
}
