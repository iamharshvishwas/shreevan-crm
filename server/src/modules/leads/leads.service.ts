import { Injectable } from '@nestjs/common';
import { Currency, Lead, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import {
  ConflictError, LeadNextActionRequiredError, NotFoundError,
} from '../../common/errors/domain.errors';
import {
  CloseLostDto, ConfirmBookingDto, ListLeadsDto, MoveStageDto, NextActionDto,
} from './dto/leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListLeadsDto): Promise<Paginated<unknown>> {
    const view = dto.view ?? 'active';
    const where: Prisma.LeadWhereInput = {};
    if (view === 'active') { where.confirmedAt = null; where.closedLostAt = null; }
    else if (view === 'hot') { where.temperature = 'HOT'; where.confirmedAt = null; where.closedLostAt = null; }
    else if (view === 'no_next_action') { where.nextAction = null; where.confirmedAt = null; where.closedLostAt = null; }
    else if (view === 'payment_pending') where.stage = { key: 'payment_pending' };
    else if (view === 'closed_lost') where.closedLostAt = { not: null };

    if (dto.stageKey) where.stage = { key: dto.stageKey };
    if (dto.ownerId) where.ownerId = dto.ownerId;
    if (dto.q) where.contact = { name: { contains: dto.q, mode: 'insensitive' } };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: { contact: { select: { name: true, country: true } }, stage: true, owner: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  async get(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        contact: { include: { identities: true } },
        stage: true,
        owner: { select: { id: true, name: true } },
        lostReason: true,
        stageHistory: { include: { fromStage: true, toStage: true }, orderBy: { at: 'desc' } },
        activities: { orderBy: { at: 'desc' } },
        booking: { include: { customer: true } },
      },
    });
    if (!lead) throw new NotFoundError('Lead', id);
    return lead;
  }

  async moveStage(id: string, dto: MoveStageDto, actorId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: { stage: true } });
    if (!lead) throw new NotFoundError('Lead', id);
    const toStage = await this.prisma.pipelineStage.findUnique({ where: { key: dto.toStageKey } });
    if (!toStage) throw new NotFoundError('Pipeline stage', dto.toStageKey);
    if (toStage.id === lead.stageId) return lead;

    // Moving into an active (non-terminal) stage requires a complete next action.
    if (!toStage.isTerminalWon && !toStage.isTerminalLost) {
      this.assertActionable(lead);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          stageId: toStage.id,
          confirmedAt: toStage.isTerminalWon ? new Date() : lead.confirmedAt,
          closedLostAt: toStage.isTerminalLost ? new Date() : lead.closedLostAt,
        },
      });
      await tx.leadStageHistory.create({ data: { leadId: id, fromStageId: lead.stageId, toStageId: toStage.id, byUserId: actorId } });
      await tx.leadActivity.create({ data: { leadId: id, type: 'STAGE', title: `Moved to ${toStage.label}`, byUserId: actorId } });
      await tx.auditLog.create({ data: { actorId, action: 'LEAD_STAGE_MOVED', entityType: 'Lead', entityId: id, metadata: { to: toStage.key } } });
      return updated;
    });
  }

  async setNextAction(id: string, dto: NextActionDto, actorId: string) {
    await this.requireLead(id);
    const lead = await this.prisma.lead.update({
      where: { id },
      data: { nextAction: dto.nextAction, nextActionDate: new Date(dto.nextActionDate), ownerId: dto.ownerId ?? undefined },
    });
    await this.prisma.leadActivity.create({ data: { leadId: id, type: 'NEXT_ACTION', title: dto.nextAction, byUserId: actorId } });
    return lead;
  }

  /** Confirm booking → create Booking + ConfirmedCustomer, move to confirmed stage. */
  async confirmBooking(id: string, dto: ConfirmBookingDto, actorId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: { booking: true } });
    if (!lead) throw new NotFoundError('Lead', id);
    if (lead.booking) throw new ConflictError('ALREADY_BOOKED', 'This lead already has a booking.');
    const stage = await this.prisma.pipelineStage.findUnique({ where: { key: 'confirmed' } });
    if (!stage) throw new ConflictError('PIPELINE_NOT_SEEDED', 'Confirmed stage missing.');

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          leadId: id,
          contactId: lead.contactId,
          cohortId: dto.cohortId,
          valueAmount: lead.expectedValueAmount ?? 0,
          valueCurrency: dto.valueCurrency ?? lead.expectedValueCurrency ?? Currency.USD,
          paymentStatus: dto.paymentStatus ?? PaymentStatus.DEPOSIT,
          customer: { create: { contactId: lead.contactId, onboardingStatus: 'NOT_STARTED' } },
        },
      });
      await tx.lead.update({ where: { id }, data: { stageId: stage.id, confirmedAt: new Date(), nextAction: 'Handover to onboarding' } });
      await tx.leadStageHistory.create({ data: { leadId: id, fromStageId: lead.stageId, toStageId: stage.id, byUserId: actorId } });
      await tx.leadActivity.create({ data: { leadId: id, type: 'BOOKING', title: 'Booking confirmed', byUserId: actorId } });
      await tx.auditLog.create({ data: { actorId, action: 'BOOKING_CONFIRMED', entityType: 'Booking', entityId: booking.id } });
      return booking;
    });
  }

  async closeLost(id: string, dto: CloseLostDto, actorId: string) {
    const lead = await this.requireLead(id);
    const stage = await this.prisma.pipelineStage.findUnique({ where: { key: 'closed_lost' } });
    const reason = await this.prisma.leadLostReason.findUnique({ where: { key: dto.reasonKey } });
    if (!stage) throw new ConflictError('PIPELINE_NOT_SEEDED', 'Closed-lost stage missing.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: { stageId: stage.id, closedLostAt: new Date(), lostReasonId: reason?.id, nextAction: null, nextActionDate: null },
      });
      await tx.leadStageHistory.create({ data: { leadId: id, fromStageId: lead.stageId, toStageId: stage.id, byUserId: actorId } });
      await tx.leadActivity.create({ data: { leadId: id, type: 'CLOSED_LOST', title: `Closed lost — ${dto.reasonKey}`, byUserId: actorId } });
      await tx.auditLog.create({ data: { actorId, action: 'LEAD_CLOSED_LOST', entityType: 'Lead', entityId: id, metadata: { reason: dto.reasonKey } } });
      return updated;
    });
  }

  /** Active leads must have owner + next action + next-action date. */
  private assertActionable(lead: Pick<Lead, 'ownerId' | 'nextAction' | 'nextActionDate'>): void {
    const missing: Record<string, string[]> = {};
    if (!lead.ownerId) missing.ownerId = ['An owner is required.'];
    if (!lead.nextAction) missing.nextAction = ['A next action is required.'];
    if (!lead.nextActionDate) missing.nextActionDate = ['A next-action date is required.'];
    if (Object.keys(missing).length) throw new LeadNextActionRequiredError(missing);
  }

  private async requireLead(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundError('Lead', id);
    return lead;
  }
}
