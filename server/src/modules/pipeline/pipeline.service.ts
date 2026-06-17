import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  stages() {
    return this.prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
  }

  lostReasons() {
    return this.prisma.leadLostReason.findMany({ orderBy: { label: 'asc' } });
  }

  /** Kanban board: every stage with its lead cards, count, and per-currency sums. */
  async board() {
    const [stages, leads] = await Promise.all([
      this.prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.lead.findMany({
        include: { contact: { select: { name: true, country: true, timezone: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return stages.map((stage) => {
      const stageLeads = leads.filter((l) => l.stageId === stage.id);
      const sums: Record<Currency, number> = { USD: 0, INR: 0 };
      for (const l of stageLeads) {
        if (l.expectedValueAmount && l.expectedValueCurrency) sums[l.expectedValueCurrency] += l.expectedValueAmount;
      }
      return {
        id: stage.id,
        key: stage.key,
        label: stage.label,
        order: stage.order,
        count: stageLeads.length,
        sums,
        leads: stageLeads.map((l) => ({
          id: l.id,
          name: l.contact.name,
          country: l.contact.country,
          timezone: l.contact.timezone,
          programInterest: l.programInterest,
          temperature: l.temperature,
          ownerId: l.ownerId,
          expectedValueAmount: l.expectedValueAmount,
          expectedValueCurrency: l.expectedValueCurrency,
          nextAction: l.nextAction,
          nextActionDate: l.nextActionDate,
          firstTouchSource: l.firstTouchSource,
        })),
      };
    });
  }
}
