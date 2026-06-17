import { useEffect, useState } from 'react';
import { api } from './client';

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
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<OverviewResponse>('/reports/overview'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return { data, loading, error, reload: load };
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
