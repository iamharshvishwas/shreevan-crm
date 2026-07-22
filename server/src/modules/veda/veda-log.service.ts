import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { VedaActionLog } from '@prisma/client';
import { CALLBACK_MARKER } from './channels/slots.util';

export interface WriteLogData {
  type: string;
  status: string;
  entityType?: string;
  entityId?: string;
  approvalId?: string;
  input?: object;
  output?: object;
  error?: string;
  costUsdMicro?: number;
  durationMs?: number;
  killedBySwitch?: boolean;
  completedAt?: Date;
}

@Injectable()
export class VedaLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(data: WriteLogData): Promise<VedaActionLog> {
    return this.prisma.vedaActionLog.create({ data });
  }

  async list(opts: { entityType?: string; entityId?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = {};
    if (opts.entityType) where['entityType'] = opts.entityType;
    if (opts.entityId)   where['entityId']   = opts.entityId;
    const [items, total] = await Promise.all([
      this.prisma.vedaActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:  opts.limit  ?? 50,
        skip:  opts.offset ?? 0,
        include: { approval: { select: { draftText: true, status: true } } },
      }),
      this.prisma.vedaActionLog.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * "Veda's Tasks" — transparency feed. PLANNED = what Veda is about to do
   * (queued/approved actions + future calls she will dial); DONE = what she
   * actually did (last 7 days of completed action logs). Derived entirely from
   * existing records — no separate task store to drift out of sync.
   */
  async tasks() {
    const now = new Date();
    const since = new Date(Date.now() - 7 * 86_400_000);

    const [queued, calls, done] = await Promise.all([
      this.prisma.vedaApproval.findMany({
        where: { status: { in: ['PENDING', 'APPROVED'] }, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: { id: true, type: true, status: true, draftText: true, createdAt: true },
      }),
      this.prisma.discoveryCall.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: now },
          // Mirror the voice scheduler's rule so this only lists calls Veda will
          // actually dial: lead-backed slots or guest-requested callbacks.
          OR: [
            { leadId: { not: null }, lead: { confirmedAt: null, closedLostAt: null } },
            { prepNotes: { contains: CALLBACK_MARKER } },
          ],
        },
        orderBy: { scheduledAt: 'asc' },
        take: 100,
        select: { id: true, scheduledAt: true, prepNotes: true, contact: { select: { name: true } } },
      }),
      this.prisma.vedaActionLog.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, createdAt: true, approval: { select: { draftText: true } } },
      }),
    ]);

    const LABEL: Record<string, string> = {
      BRAIN: 'Understood a new lead',
      QUALIFY_LEAD: 'Qualified a lead',
      EMAIL_SENT: 'Sent an email',
      WHATSAPP_SENT: 'Sent a WhatsApp message',
      VOICE_PLACED: 'Placed a voice call',
      VOICE_COMPLETED: 'Completed a voice call',
      CHAT_REPLY: 'Replied in live chat',
      SEND_EMAIL: 'Drafted an email',
      SEND_WHATSAPP: 'Drafted a WhatsApp message',
      NURTURE: 'Sent a nurture follow-up',
      SELF_LEARN: 'Learned a new answer',
    };

    return {
      planned: [
        ...queued.map((a) => ({
          id: a.id,
          kind: a.type,
          label: a.status === 'PENDING' ? `Waiting for approval: ${a.draftText}` : a.draftText,
          at: null as string | null, // delivered by the executor within ~30s of approval
          status: a.status,
        })),
        ...calls.map((c) => ({
          id: c.id,
          kind: 'VOICE_CALL',
          label: `Call ${c.contact?.name ?? 'guest'}${c.prepNotes?.includes(CALLBACK_MARKER) ? ' (they asked to be called)' : ' for their discovery call'}`,
          at: c.scheduledAt.toISOString(),
          status: 'SCHEDULED',
        })),
      ],
      done: done.map((l) => ({
        id: l.id,
        kind: l.type,
        label: LABEL[l.type] ?? l.type,
        detail: l.approval?.draftText ?? null,
        at: l.createdAt.toISOString(),
      })),
    };
  }

  /** ROI dashboard: funnel, cost efficiency, response time, channel + nurture breakdown. */
  async analytics() {
    const [
      totalLeads, qualified, discoveryCalls, completedCalls, bookings,
      costAgg, byType, chatAgg, nurture, knowledge, replyRate,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.vedaActionLog.count({ where: { type: 'QUALIFY_LEAD', status: 'COMPLETED' } }),
      this.prisma.discoveryCall.count(),
      this.prisma.discoveryCall.count({ where: { status: 'COMPLETED' } }),
      this.prisma.booking.count(),
      this.prisma.vedaActionLog.aggregate({ _sum: { costUsdMicro: true } }),
      this.prisma.vedaActionLog.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.vedaActionLog.aggregate({ where: { type: 'CHAT_REPLY', status: 'COMPLETED' }, _avg: { durationMs: true } }),
      this.prisma.nurtureEnrollment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.vedaKnowledge.count({ where: { active: true } }),
      this.replyRate(),
    ]);

    const totalCostUsd = (costAgg._sum.costUsdMicro ?? 0) / 1_000_000;
    const actionsByType: Record<string, number> = {};
    for (const row of byType) actionsByType[row.type] = row._count._all;

    const nurtureByStatus: Record<string, number> = {};
    for (const row of nurture) nurtureByStatus[row.status] = row._count._all;

    return {
      funnel: { totalLeads, qualified, discoveryCalls, completedCalls, bookings },
      conversion: {
        qualifyRate: pct(qualified, totalLeads),
        callRate: pct(discoveryCalls, qualified),
        bookingRate: pct(bookings, discoveryCalls),
      },
      cost: {
        totalUsd: totalCostUsd.toFixed(4),
        perBookingUsd: bookings ? (totalCostUsd / bookings).toFixed(4) : '—',
      },
      avgChatReplyMs: Math.round(chatAgg._avg.durationMs ?? 0),
      channels: {
        email: actionsByType['EMAIL_SENT'] ?? 0,
        whatsapp: actionsByType['WHATSAPP_SENT'] ?? 0,
        voice: actionsByType['VOICE_PLACED'] ?? 0,
        chat: actionsByType['CHAT_REPLY'] ?? 0,
      },
      nurture: { active: nurtureByStatus['ACTIVE'] ?? 0, completed: nurtureByStatus['COMPLETED'] ?? 0, stopped: nurtureByStatus['STOPPED'] ?? 0 },
      knowledgeEntries: knowledge,
      replyRate,
    };
  }

  /**
   * Feedback signal: of the emails/WhatsApp messages Veda sent in the last 30
   * days, how many got an actual reply from the guest afterward? A proxy for
   * "are Veda's autonomous messages landing well" — not perfect (a guest may
   * reply about something unrelated, or need no reply at all), but far better
   * than no signal. Derived entirely from existing logs/messages.
   */
  private async replyRate(days = 30): Promise<{ sent: number; replied: number; rate: number }> {
    const since = new Date(Date.now() - days * 86_400_000);
    const sentLogs = await this.prisma.vedaActionLog.findMany({
      where: { type: { in: ['EMAIL_SENT', 'WHATSAPP_SENT'] }, status: 'COMPLETED', createdAt: { gte: since }, entityId: { not: null } },
      select: { entityType: true, entityId: true, createdAt: true },
    });
    if (!sentLogs.length) return { sent: 0, replied: 0, rate: 0 };

    // Each log's entityId is an Enquiry/Lead/DiscoveryCall id depending on which
    // flow triggered the send — resolve all three to the underlying contactId.
    const idsByType = { Enquiry: [] as string[], Lead: [] as string[], DiscoveryCall: [] as string[] };
    for (const l of sentLogs) if (l.entityType && l.entityType in idsByType) idsByType[l.entityType as keyof typeof idsByType].push(l.entityId!);

    const [enquiries, leads, calls] = await Promise.all([
      this.prisma.enquiry.findMany({ where: { id: { in: idsByType.Enquiry } }, select: { id: true, contactId: true } }),
      this.prisma.lead.findMany({ where: { id: { in: idsByType.Lead } }, select: { id: true, contactId: true } }),
      this.prisma.discoveryCall.findMany({ where: { id: { in: idsByType.DiscoveryCall } }, select: { id: true, contactId: true } }),
    ]);
    const contactByEntity = new Map<string, string>();
    for (const e of enquiries) contactByEntity.set(e.id, e.contactId);
    for (const l of leads) contactByEntity.set(l.id, l.contactId);
    for (const c of calls) if (c.contactId) contactByEntity.set(c.id, c.contactId);

    let replied = 0;
    for (const log of sentLogs) {
      const contactId = contactByEntity.get(log.entityId!);
      if (!contactId) continue;
      const reply = await this.prisma.message.findFirst({
        where: { conversation: { contactId }, direction: 'INBOUND', occurredAt: { gt: log.createdAt } },
        select: { id: true },
      });
      if (reply) replied++;
    }
    return { sent: sentLogs.length, replied, rate: pct(replied, sentLogs.length) };
  }

  async summary() {
    const [total, completed, failed, todayCost] = await Promise.all([
      this.prisma.vedaActionLog.count(),
      this.prisma.vedaActionLog.count({ where: { status: 'COMPLETED' } }),
      this.prisma.vedaActionLog.count({ where: { status: 'FAILED' } }),
      this.prisma.vedaActionLog.aggregate({
        where:   { createdAt: { gte: startOfDay() } },
        _sum:    { costUsdMicro: true },
      }),
    ]);
    return {
      total,
      completed,
      failed,
      todayCostUsd: ((todayCost._sum.costUsdMicro ?? 0) / 1_000_000).toFixed(4),
    };
  }
}

function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Whole-number percentage, guarding divide-by-zero. */
function pct(num: number, denom: number): number {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}
