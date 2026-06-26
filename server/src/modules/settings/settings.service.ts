import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  channels() {
    return this.prisma.channelConnection.findMany({ orderBy: { channel: 'asc' } });
  }

  slaPolicies() {
    return this.prisma.slaPolicy.findMany({ orderBy: { firstResponseMins: 'asc' } });
  }

  routingRules() {
    return this.prisma.routingRule.findMany({ orderBy: { priorityOrder: 'asc' } });
  }

  /**
   * Wipe all transactional CRM activity (contacts, enquiries, leads,
   * conversations, calls, tasks, notifications, Veda logs, etc.) to clear
   * demo/test data before go-live. Preserves setup: users, programs, pipeline
   * stages, SLA policies, lost reasons, routing rules, channel connections,
   * Veda config + knowledge base. Runs in one transaction (all-or-nothing) and
   * requires confirm === "RESET".
   */
  async resetTransactionalData(confirm?: string) {
    if (confirm !== 'RESET') {
      throw new BadRequestException('Confirmation required: send { "confirm": "RESET" } to wipe demo data.');
    }
    const counts = await this.prisma.$transaction(async (tx) => {
      const c: Record<string, number> = {};
      // Children first → parents last, so foreign keys never block a delete.
      c.messageAttachment = (await tx.messageAttachment.deleteMany({})).count;
      c.message = (await tx.message.deleteMany({})).count;
      c.conversation = (await tx.conversation.deleteMany({})).count;
      c.vedaActionLog = (await tx.vedaActionLog.deleteMany({})).count;
      c.vedaApproval = (await tx.vedaApproval.deleteMany({})).count;
      c.vedaKnowledgeGap = (await tx.vedaKnowledgeGap.deleteMany({})).count;
      c.nurtureEnrollment = (await tx.nurtureEnrollment.deleteMany({})).count;
      c.slaEvent = (await tx.slaEvent.deleteMany({})).count;
      c.internalNote = (await tx.internalNote.deleteMany({})).count;
      c.enquiryTag = (await tx.enquiryTag.deleteMany({})).count;
      c.enquiryAssignmentHistory = (await tx.enquiryAssignmentHistory.deleteMany({})).count;
      c.task = (await tx.task.deleteMany({})).count;
      c.discoveryCall = (await tx.discoveryCall.deleteMany({})).count;
      c.booking = (await tx.booking.deleteMany({})).count;
      c.confirmedCustomer = (await tx.confirmedCustomer.deleteMany({})).count;
      c.leadActivity = (await tx.leadActivity.deleteMany({})).count;
      c.leadStageHistory = (await tx.leadStageHistory.deleteMany({})).count;
      c.leadOwnerHistory = (await tx.leadOwnerHistory.deleteMany({})).count;
      c.inboundEvent = (await tx.inboundEvent.deleteMany({})).count;
      c.notification = (await tx.notification.deleteMany({})).count;
      c.contactMergeAudit = (await tx.contactMergeAudit.deleteMany({})).count;
      c.contactMergeSuggestion = (await tx.contactMergeSuggestion.deleteMany({})).count;
      c.enquiry = (await tx.enquiry.deleteMany({})).count;
      c.lead = (await tx.lead.deleteMany({})).count;
      c.contactIdentity = (await tx.contactIdentity.deleteMany({})).count;
      c.contact = (await tx.contact.deleteMany({})).count;
      return c;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    this.logger.warn(`Transactional data reset: ${total} rows deleted. ${JSON.stringify(counts)}`);
    return { ok: true, totalDeleted: total, deleted: counts };
  }
}
