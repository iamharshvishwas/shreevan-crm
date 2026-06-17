import { Injectable } from '@nestjs/common';
import { EnquiryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConflictError, LeadNextActionRequiredError, NotFoundError } from '../../common/errors/domain.errors';
import { ConvertToLeadDto } from './dto/enquiries.dto';
import { normalizeEmail, normalizePhone } from '../contacts/identity.util';

const QUALIFIED_STAGE_KEY = 'qualified';

@Injectable()
export class ConversionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Credible existing leads for the enquiry's contact — surfaced, never auto-linked. */
  async duplicateLeads(enquiryId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: { contact: { include: { identities: true, leads: { include: { stage: true } } } } },
    });
    if (!enquiry) throw new NotFoundError('Enquiry', enquiryId);
    const emails = enquiry.contact.identities.filter((i) => i.channel === 'EMAIL').map((i) => normalizeEmail(i.handle));
    const phones = enquiry.contact.identities.filter((i) => i.channel === 'WHATSAPP' || i.channel === 'PHONE').map((i) => normalizePhone(i.handle));
    // Same contact's leads are the strongest signal; cross-contact name match is a softer hint.
    const byName = await this.prisma.lead.findMany({
      where: { contact: { name: { equals: enquiry.contact.name, mode: 'insensitive' } } },
      include: { stage: true, contact: { select: { name: true } } },
      take: 5,
    });
    return { leads: byName, signals: { emails, phones } };
  }

  /**
   * Transactional, duplicate-safe conversion. Requires owner + next action +
   * date. Re-running on an already-linked enquiry returns the existing lead.
   */
  async convert(enquiryId: string, dto: ConvertToLeadDto, actorId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: { contact: true },
    });
    if (!enquiry) throw new NotFoundError('Enquiry', enquiryId);

    // Idempotent: never create a second lead for the same enquiry.
    if (enquiry.leadId) {
      return this.prisma.lead.findUnique({ where: { id: enquiry.leadId } });
    }

    // Link to an existing lead instead of creating one.
    if (dto.linkExistingLeadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: dto.linkExistingLeadId } });
      if (!lead) throw new NotFoundError('Lead', dto.linkExistingLeadId);
      await this.prisma.enquiry.update({ where: { id: enquiryId }, data: { leadId: lead.id, status: EnquiryStatus.RESOLVED } });
      return lead;
    }

    // Enforce the active-lead rule up front.
    const ownerId = dto.ownerId ?? enquiry.ownerId ?? undefined;
    const missing: Record<string, string[]> = {};
    if (!ownerId) missing.ownerId = ['An owner is required.'];
    if (!dto.nextAction?.trim()) missing.nextAction = ['A next action is required.'];
    if (!dto.nextActionDate) missing.nextActionDate = ['A next-action date is required.'];
    if (Object.keys(missing).length) throw new LeadNextActionRequiredError(missing);

    const stage = await this.prisma.pipelineStage.findUnique({ where: { key: QUALIFIED_STAGE_KEY } });
    if (!stage) throw new ConflictError('PIPELINE_NOT_SEEDED', 'Pipeline stages are not configured.');

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          contactId: enquiry.contactId,
          stageId: stage.id,
          temperature: dto.temperature ?? 'WARM',
          ownerId,
          programInterest: dto.programInterest ?? enquiry.programInterest,
          expectedValueAmount: dto.expectedValueAmount ?? enquiry.expectedValueAmount ?? undefined,
          expectedValueCurrency: dto.expectedValueCurrency ?? enquiry.expectedValueCurrency ?? undefined,
          firstTouchSource: enquiry.firstTouchSource, // preserve first-touch attribution
          nextAction: dto.nextAction,
          nextActionDate: new Date(dto.nextActionDate),
          healthScreening: 'REQUIRED',
          eligibility: 'PENDING',
        },
      });

      await tx.leadStageHistory.create({ data: { leadId: lead.id, toStageId: stage.id, byUserId: actorId } });
      await tx.leadActivity.create({
        data: { leadId: lead.id, type: 'CONVERTED', title: 'Qualified from enquiry', body: `Channel: ${enquiry.channel}`, byUserId: actorId },
      });
      await tx.enquiry.update({ where: { id: enquiryId }, data: { leadId: lead.id, status: EnquiryStatus.RESOLVED } });
      await tx.notification.create({
        data: { userId: ownerId, type: 'LEAD_CREATED', title: 'New qualified lead', body: enquiry.contact.name, entityType: 'Lead', entityId: lead.id },
      });
      await tx.auditLog.create({
        data: { actorId, action: 'ENQUIRY_CONVERTED', entityType: 'Lead', entityId: lead.id, metadata: { enquiryId } as Prisma.InputJsonValue },
      });
      return lead;
    });
  }
}
