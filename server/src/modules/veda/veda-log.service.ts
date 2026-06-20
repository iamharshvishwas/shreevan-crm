import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { VedaActionLog } from '@prisma/client';

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

  /** ROI dashboard: funnel, cost efficiency, response time, channel + nurture breakdown. */
  async analytics() {
    const [
      totalLeads, qualified, discoveryCalls, completedCalls, bookings,
      costAgg, byType, chatAgg, nurture, knowledge,
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
    };
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
