import { useEffect, useState } from 'react';
import { api } from './client';
import type { Channel } from './enquiries';

export type ConnectionStatus = 'CONNECTED' | 'SIMULATED' | 'TOKEN_EXPIRING' | 'DISCONNECTED' | 'NOT_CONFIGURED';

export interface ChannelConnection {
  id: string; channel: Channel; label: string; status: ConnectionStatus;
  detail: string | null; inboundEnabled: boolean; outboundEnabled: boolean;
}
export interface SlaPolicy {
  id: string; key: string; label: string; firstResponseMins: number; appliesTo: string; pauseWhenWaitingCustomer: boolean; enabled: boolean;
}
export interface RoutingRule {
  id: string; label: string; whenCountry: string | null; whenChannel: Channel | null; assignToUserId: string | null; priorityOrder: number; enabled: boolean;
}

export const CONN_STATUS: Record<ConnectionStatus, { label: string; bg: string; fg: string }> = {
  CONNECTED: { label: 'Connected', bg: '#e4efe8', fg: '#2e6a4d' },
  SIMULATED: { label: 'Simulated', bg: '#e0ebef', fg: '#2f6680' },
  TOKEN_EXPIRING: { label: 'Token expiring', bg: '#f1e8d3', fg: '#806019' },
  DISCONNECTED: { label: 'Disconnected', bg: '#f2e0e0', fg: '#9e3f3f' },
  NOT_CONFIGURED: { label: 'Not configured', bg: '#ece4d3', fg: '#5e6863' },
};

function useGet<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => { api.get<T>(path).then(setData).catch(() => setData(null)); }, [path]);
  return data;
}

export const useChannels = () => useGet<ChannelConnection[]>('/settings/channels');
export const useSlaPolicies = () => useGet<SlaPolicy[]>('/settings/sla-policies');
export const useRoutingRules = () => useGet<RoutingRule[]>('/settings/routing-rules');
