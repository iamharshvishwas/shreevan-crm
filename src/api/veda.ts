import { api } from './client';

export interface VedaStepConfig { enabled: boolean; autoApprove: boolean; }
export interface VedaConfig {
  globalEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  dailyMessageLimit: number;
  steps: {
    BRAIN:         VedaStepConfig;
    QUALIFY_LEAD:  VedaStepConfig;
    SEND_EMAIL:    VedaStepConfig;
    SEND_WHATSAPP: VedaStepConfig;
    VOICE_CALL:    VedaStepConfig;
    CHAT_REPLY:    VedaStepConfig;
    NURTURE:       VedaStepConfig;
    SELF_LEARN:    VedaStepConfig;
  };
}

export interface KnowledgeGap {
  id: string;
  question: string;
  channel: string | null;
  occurrences: number;
  status: 'OPEN' | 'ANSWERED' | 'PENDING' | 'APPLIED' | 'DISMISSED';
  capturedAnswer: string | null;
  draftTitle: string | null;
  draftContent: string | null;
  draftCategory: string | null;
  createdAt: string;
}

export interface LearningStats { open: number; answered: number; pending: number; applied: number; }

export interface VedaAnalytics {
  funnel: { totalLeads: number; qualified: number; discoveryCalls: number; completedCalls: number; bookings: number };
  conversion: { qualifyRate: number; callRate: number; bookingRate: number };
  cost: { totalUsd: string; perBookingUsd: string };
  avgChatReplyMs: number;
  channels: { email: number; whatsapp: number; voice: number; chat: number };
  nurture: { active: number; completed: number; stopped: number };
  knowledgeEntries: number;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  active: boolean;
  updatedAt: string;
}

export interface VedaApproval {
  id: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'AUTO_SENT';
  entityType: string;
  entityId: string;
  draftText: string;
  context: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface VedaActionLog {
  id: string;
  type: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  error: string | null;
  costUsdMicro: number | null;
  durationMs: number | null;
  killedBySwitch: boolean;
  createdAt: string;
  completedAt: string | null;
  approval: { draftText: string; status: string } | null;
}

export interface VedaSummary {
  total: number;
  completed: number;
  failed: number;
  todayCostUsd: string;
}

/** One row in the "Veda's Tasks" transparency feed. */
export interface VedaTask {
  id: string;
  kind: string;
  label: string;
  detail?: string | null;
  /** ISO time (scheduled/done). null = "as soon as possible" (executor picks it up). */
  at: string | null;
  status?: string;
}
export interface VedaTasks { planned: VedaTask[]; done: VedaTask[]; }

export interface VedaCommandResult {
  reply: string;
  actions: string[];
  costUsdMicro: number;
}

export const vedaApi = {
  getConfig:      () => api.get<VedaConfig>('/veda/config'),
  updateConfig:   (body: Partial<VedaConfig> & Record<string, unknown>) =>
    api.patch<VedaConfig>('/veda/config', body),
  listApprovals:  (status?: string) =>
    api.get<{ items: VedaApproval[]; total: number }>(
      `/veda/approvals${status ? `?status=${status}` : ''}`
    ),
  approve:        (id: string, note?: string) =>
    api.patch<VedaApproval>(`/veda/approvals/${id}/approve`, { note }),
  reject:         (id: string, note?: string) =>
    api.patch<VedaApproval>(`/veda/approvals/${id}/reject`, { note }),
  getLogs:        (limit = 30) =>
    api.get<{ items: VedaActionLog[]; total: number }>(`/veda/logs?limit=${limit}`),
  getSummary:     () => api.get<VedaSummary>('/veda/summary'),
  getTasks:       () => api.get<VedaTasks>('/veda/tasks'),
  pendingCount:   () => api.get<{ count: number }>('/veda/pending-count'),
  command:        (transcript: string) =>
    api.post<VedaCommandResult>('/veda/command', { transcript }),
  getAnalytics:   () => api.get<VedaAnalytics>('/veda/analytics'),
  testEmail:      (to?: string) =>
    api.post<{ to: string; delivered: boolean; simulated: boolean; detail: string }>('/veda/test-email', { to }),
  testCall:       (to: string) =>
    api.post<{ to?: string; placed?: boolean; simulated?: boolean; detail?: string; error?: string }>('/veda/test-call', { to }),
  // Knowledge base
  listKnowledge:  () => api.get<KnowledgeEntry[]>('/veda/knowledge'),
  createKnowledge: (body: { title: string; content: string; category?: string; tags?: string[]; active?: boolean }) =>
    api.post<KnowledgeEntry>('/veda/knowledge', body),
  updateKnowledge: (id: string, body: Partial<{ title: string; content: string; category: string; tags: string[]; active: boolean }>) =>
    api.patch<KnowledgeEntry>(`/veda/knowledge/${id}`, body),
  deleteKnowledge: (id: string) => api.delete<{ ok: true }>(`/veda/knowledge/${id}`),
  importPrograms:  () => api.post<{ created: number }>('/veda/knowledge/import-programs'),
  seedShreevan:    () => api.post<{ created: number; updated: number; skipped: number; removed: number }>('/veda/knowledge/seed-shreevan'),
  // Self-learning
  listGaps:        (status?: string) => api.get<KnowledgeGap[]>(`/veda/learning${status ? `?status=${status}` : ''}`),
  learningStats:   () => api.get<LearningStats>('/veda/learning/stats'),
  approveGap:      (id: string) => api.post<{ ok: boolean; knowledgeId?: string }>(`/veda/learning/${id}/approve`),
  dismissGap:      (id: string) => api.post<{ ok: boolean }>(`/veda/learning/${id}/dismiss`),
};
