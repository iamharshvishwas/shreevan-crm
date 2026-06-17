import { Injectable } from '@nestjs/common';
import { Channel, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { ConflictError, NotFoundError } from '../../common/errors/domain.errors';
import { ListContactsDto } from './dto/contacts.dto';
import { normalizeHandle } from './identity.util';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListContactsDto): Promise<Paginated<unknown>> {
    const where: Prisma.ContactWhereInput = {};
    if (dto.country) where.country = dto.country;
    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { identities: { some: { normalizedHandle: { contains: normalizeHandle(Channel.EMAIL, dto.q) } } } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: { identities: true },
        orderBy: { updatedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  async get(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        identities: true,
        enquiries: { select: { id: true, status: true, channel: true, createdAt: true } },
        leads: { select: { id: true, stageId: true, temperature: true } },
        customer: true,
      },
    });
    if (!contact) throw new NotFoundError('Contact', id);
    return contact;
  }

  async addIdentity(contactId: string, channel: Channel, handle: string, displayName?: string) {
    await this.get(contactId);
    const normalizedHandle = normalizeHandle(channel, handle);
    const existing = await this.prisma.contactIdentity.findUnique({
      where: { channel_normalizedHandle: { channel, normalizedHandle } },
    });
    if (existing && existing.contactId !== contactId) {
      throw new ConflictError('IDENTITY_TAKEN', 'This identity already belongs to another contact.');
    }
    return this.prisma.contactIdentity.upsert({
      where: { channel_normalizedHandle: { channel, normalizedHandle } },
      update: { displayName },
      create: { contactId, channel, handle, normalizedHandle, displayName, verified: false },
    });
  }

  mergeSuggestions(contactId: string) {
    return this.prisma.contactMergeSuggestion.findMany({
      where: {
        status: 'PENDING',
        OR: [{ contactAId: contactId }, { contactBId: contactId }],
      },
    });
  }

  /** Deliberate, transactional, audited merge. Never called automatically. */
  async reviewMerge(suggestionId: string, decision: 'merge' | 'dismiss', actorId: string) {
    const suggestion = await this.prisma.contactMergeSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new NotFoundError('Merge suggestion', suggestionId);
    if (suggestion.status !== 'PENDING') {
      throw new ConflictError('SUGGESTION_RESOLVED', 'This suggestion has already been reviewed.');
    }

    if (decision === 'dismiss') {
      return this.prisma.contactMergeSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'DISMISSED' },
      });
    }

    // Keep the contact that already has a lead/customer where possible.
    const [a, b] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: suggestion.contactAId }, include: { customer: true, leads: true } }),
      this.prisma.contact.findUnique({ where: { id: suggestion.contactBId }, include: { customer: true, leads: true } }),
    ]);
    if (!a || !b) throw new NotFoundError('Contact');
    if (a.customer && b.customer) {
      throw new ConflictError('MERGE_CONFLICT', 'Both contacts are confirmed customers; merge manually.');
    }
    const keep = b.leads.length > a.leads.length || (!!b.customer && !a.customer) ? b : a;
    const drop = keep.id === a.id ? b : a;

    return this.prisma.$transaction(async (tx) => {
      await tx.contactIdentity.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.conversation.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.enquiry.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.lead.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.task.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.discoveryCall.updateMany({ where: { contactId: drop.id }, data: { contactId: keep.id } });
      await tx.contactMergeAudit.create({
        data: {
          keptContactId: keep.id,
          mergedContactId: drop.id,
          actorId,
          evidence: suggestion.evidence as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.contactMergeSuggestion.update({ where: { id: suggestionId }, data: { status: 'MERGED' } });
      await tx.auditLog.create({
        data: { actorId, action: 'CONTACT_MERGED', entityType: 'Contact', entityId: keep.id, metadata: { mergedId: drop.id } },
      });
      await tx.contact.delete({ where: { id: drop.id } });
      return tx.contact.findUnique({ where: { id: keep.id }, include: { identities: true } });
    });
  }
}
