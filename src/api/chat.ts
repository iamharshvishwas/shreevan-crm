import { api } from './client';

export interface ChatConversationSummary {
  id: string;
  visitor: string;
  country: string | null;
  handoverToHuman: boolean;
  needsAttention: boolean;
  attentionReason: string | null;
  lastMessage: string;
  lastDirection: 'INBOUND' | 'OUTBOUND' | 'INTERNAL' | null;
  lastAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  authorName: string;
  occurredAt: string;
}

export interface ChatThread {
  id: string;
  visitor: string;
  country: string | null;
  handoverToHuman: boolean;
  needsAttention: boolean;
  attentionReason: string | null;
  messages: ChatMessage[];
}

export const liveChatApi = {
  list:      () => api.get<ChatConversationSummary[]>('/chat/conversations'),
  thread:    (id: string) => api.get<ChatThread>(`/chat/conversations/${id}`),
  handover:  (id: string, toHuman: boolean) =>
    api.post<{ ok: boolean }>(`/chat/conversations/${id}/handover`, { toHuman }),
  reply:     (id: string, text: string) =>
    api.post<{ ok: boolean }>(`/chat/conversations/${id}/reply`, { text }),
};
