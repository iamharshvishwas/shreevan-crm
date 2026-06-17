import { Enquiry, SlaPolicy } from '@prisma/client';

export type SlaState = 'none' | 'on_track' | 'warning' | 'breached' | 'completed' | 'paused';

export interface SlaInfo {
  state: SlaState;
  dueAt: Date | null;
}

/** First-response SLA. Pure + timezone-agnostic (all UTC). */
export function computeSla(enquiry: Pick<Enquiry, 'status' | 'firstRespondedAt' | 'lastInboundAt'>, policy: SlaPolicy | null, now: Date = new Date()): SlaInfo {
  if (!policy || enquiry.status === 'RESOLVED' || enquiry.status === 'SPAM') return { state: 'none', dueAt: null };
  if (enquiry.firstRespondedAt) return { state: 'completed', dueAt: null };
  if (enquiry.status === 'WAITING_FOR_CUSTOMER' && policy.pauseWhenWaitingCustomer) return { state: 'paused', dueAt: null };

  const due = new Date(enquiry.lastInboundAt.getTime() + policy.firstResponseMins * 60_000);
  const diffMin = (due.getTime() - now.getTime()) / 60_000;
  if (diffMin < 0) return { state: 'breached', dueAt: due };
  if (diffMin <= policy.firstResponseMins * 0.25) return { state: 'warning', dueAt: due };
  return { state: 'on_track', dueAt: due };
}
