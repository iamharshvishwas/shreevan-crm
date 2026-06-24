import { Injectable, Logger } from '@nestjs/common';
import {
  Channel, Contact, DeliveryState, EnquiryStatus, MessageDirection, Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { normalizeEmail, normalizeHandle, normalizePhone } from '../contacts/identity.util';
import { NormalizedInboundEvent } from './dto/inbound-event.dto';

export type IngestStatus = 'processed' | 'duplicate' | 'failed';
export interface IngestResult {
  status: IngestStatus;
  enquiryId?: string;
  conversationId?: string;
  message: string;
}

const SLA_KEY_BY_CHANNEL: Partial<Record<Channel, string>> = {
  [Channel.WHATSAPP]: 'wa_hot',
  [Channel.INSTAGRAM]: 'ig',
  [Channel.FACEBOOK]: 'ig',
  [Channel.WEBSITE_FORM]: 'web',
  [Channel.WEBSITE_CHAT]: 'web',
  [Channel.EMAIL]: 'email',
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * validate → persist immutable event (claims idempotency) → resolve contact →
   * upsert conversation + message → upsert enquiry → route + SLA → notify/audit.
   */
  async ingest(ev: NormalizedInboundEvent, opts: { simulated?: boolean } = {}): Promise<IngestResult> {
    // 1. Persist the immutable event — the unique (connection, externalMessageId)
    //    constraint makes replays idempotent.
    let eventId: string;
    try {
      const event = await this.prisma.inboundEvent.create({
        data: {
          connectionId: ev.connectionId,
          provider: ev.provider,
          externalEventId: ev.externalEventId,
          externalMessageId: ev.externalMessageId,
          externalConversationId: ev.externalConversationId,
          rawPayload: (ev.rawPayload ?? {}) as Prisma.InputJsonValue,
          normalized: ev as unknown as Prisma.InputJsonValue,
          simulated: opts.simulated ?? false,
          status: 'PENDING_REVIEW',
        },
      });
      eventId = event.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { status: 'duplicate', message: 'Duplicate event ignored (idempotent).' };
      }
      throw e;
    }

    // 2. Process. On failure, mark the event FAILED so it can be retried.
    try {
      const result = await this.process(ev);
      await this.prisma.inboundEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      return result;
    } catch (e) {
      this.logger.error(`Ingest failed for event ${eventId}: ${(e as Error).message}`);
      await this.prisma.inboundEvent.update({
        where: { id: eventId },
        data: { status: 'FAILED', error: (e as Error).message },
      });
      return { status: 'failed', message: 'Processing failed — event stored for retry.' };
    }
  }

  /** Reprocess a previously failed event from its stored normalized payload. */
  async retry(eventId: string): Promise<IngestResult> {
    const event = await this.prisma.inboundEvent.findUnique({ where: { id: eventId } });
    if (!event || !event.normalized) return { status: 'failed', message: 'Event not found or has no payload.' };
    try {
      const result = await this.process(event.normalized as unknown as NormalizedInboundEvent);
      await this.prisma.inboundEvent.update({ where: { id: eventId }, data: { status: 'PROCESSED', processedAt: new Date(), error: null } });
      return result;
    } catch (e) {
      await this.prisma.inboundEvent.update({ where: { id: eventId }, data: { status: 'FAILED', error: (e as Error).message } });
      return { status: 'failed', message: 'Retry failed.' };
    }
  }

  private async process(ev: NormalizedInboundEvent): Promise<IngestResult> {
    const contact = await this.resolveContact(ev);

    return this.prisma.$transaction(async (tx) => {
      // Find an open enquiry for this contact, or create one.
      let enquiry = await tx.enquiry.findFirst({
        where: { contactId: contact.id, status: { in: [EnquiryStatus.NEEDS_REPLY, EnquiryStatus.WAITING_FOR_CUSTOMER] }, leadId: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!enquiry) {
        const owner = await this.routeOwner(tx, ev, contact);
        const slaPolicy = await this.pickSla(tx, ev.provider);
        enquiry = await tx.enquiry.create({
          data: {
            contactId: contact.id,
            status: EnquiryStatus.NEEDS_REPLY,
            channel: ev.provider,
            firstTouchSource: ev.attribution.firstTouchSource,
            ownerId: owner,
            slaPolicyId: slaPolicy,
            lastInboundAt: new Date(ev.occurredAt),
            lastMessageAt: new Date(ev.occurredAt),
            programInterest: detectProgram(ev.message.text),
          },
        });
        if (owner) {
          await tx.enquiryAssignmentHistory.create({ data: { enquiryId: enquiry.id, toOwnerId: owner } });
        }
      } else {
        enquiry = await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { channel: ev.provider, lastInboundAt: new Date(ev.occurredAt), lastMessageAt: new Date(ev.occurredAt), status: EnquiryStatus.NEEDS_REPLY },
        });
      }

      // Conversation per external thread.
      let conversation = await tx.conversation.findFirst({
        where: { contactId: contact.id, connectionId: ev.connectionId, externalConversationId: ev.externalConversationId },
      });
      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            connectionId: ev.connectionId,
            channel: ev.provider,
            contactId: contact.id,
            enquiryId: enquiry.id,
            externalConversationId: ev.externalConversationId,
            subject: ev.message.text.slice(0, 80),
          },
        });
      }

      // Message — idempotent within the conversation.
      const existingMsg = await tx.message.findFirst({
        where: { conversationId: conversation.id, externalMessageId: ev.externalMessageId },
      });
      if (!existingMsg) {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            externalMessageId: ev.externalMessageId,
            direction: MessageDirection.INBOUND,
            channel: ev.provider,
            authorName: contact.name,
            body: ev.message.text,
            delivery: DeliveryState.RECEIVED,
            occurredAt: new Date(ev.occurredAt),
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: enquiry.ownerId ?? undefined,
          type: 'ENQUIRY_RECEIVED',
          title: `New ${ev.provider} enquiry`,
          body: contact.name,
          entityType: 'Enquiry',
          entityId: enquiry.id,
        },
      });
      await tx.auditLog.create({
        data: { action: 'ENQUIRY_INGESTED', entityType: 'Enquiry', entityId: enquiry.id, metadata: { channel: ev.provider } },
      });

      return { status: 'processed' as const, enquiryId: enquiry.id, conversationId: conversation.id, message: `Enquiry from ${contact.name} ingested.` };
    });
  }

  /** Exact, safe link only — channel handle / verified email / phone. */
  private async resolveContact(ev: NormalizedInboundEvent): Promise<Contact> {
    const candidates: { channel: Channel; handle: string }[] = [
      { channel: ev.provider, handle: ev.sender.providerIdentityId },
    ];
    if (ev.sender.email) candidates.push({ channel: Channel.EMAIL, handle: normalizeEmail(ev.sender.email) });
    if (ev.sender.phone) candidates.push({ channel: Channel.WHATSAPP, handle: normalizePhone(ev.sender.phone) });

    let contact: Contact | null = null;
    for (const c of candidates) {
      const id = await this.prisma.contactIdentity.findUnique({
        where: { channel_normalizedHandle: { channel: c.channel, normalizedHandle: normalizeHandle(c.channel, c.handle) } },
        include: { contact: true },
      });
      if (id) { contact = id.contact; break; }
    }

    // Create a new contact + its first identity. (Fuzzy duplicates become
    // review suggestions elsewhere — never auto-merged here.)
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          name: ev.sender.displayName || 'Unknown enquirer',
          firstTouchSource: ev.attribution.firstTouchSource,
          identities: {
            create: {
              channel: ev.provider,
              handle: ev.sender.providerIdentityId,
              normalizedHandle: normalizeHandle(ev.provider, ev.sender.providerIdentityId),
              displayName: ev.sender.displayName,
              verified: ev.provider !== Channel.EMAIL,
            },
          },
        },
      });
    }

    // Enrich with any new details the sender provided (name they typed in the
    // chat pre-form, email, WhatsApp). This is what makes each website chat a
    // named, contactable lead — and lets a returning visitor link to the same
    // contact across sessions via their email/phone.
    return this.enrichContact(contact, ev);
  }

  /** Fill in a real name + attach email / WhatsApp identities when provided. */
  private async enrichContact(contact: Contact, ev: NormalizedInboundEvent): Promise<Contact> {
    let current = contact;

    const provided = ev.sender.displayName?.trim();
    if (provided && !isPlaceholderName(provided) && isPlaceholderName(current.name) && provided !== current.name) {
      current = await this.prisma.contact.update({ where: { id: current.id }, data: { name: provided } });
    }

    // Attach email + phone as identities (idempotent). If the handle already
    // exists (even on another contact) we leave it untouched — never steal it.
    const extras: { channel: Channel; raw: string }[] = [];
    if (ev.sender.email) extras.push({ channel: Channel.EMAIL, raw: ev.sender.email });
    if (ev.sender.phone) extras.push({ channel: Channel.WHATSAPP, raw: ev.sender.phone });

    for (const x of extras) {
      const normalized = normalizeHandle(x.channel, x.raw);
      if (!normalized) continue;
      const existing = await this.prisma.contactIdentity.findUnique({
        where: { channel_normalizedHandle: { channel: x.channel, normalizedHandle: normalized } },
        select: { id: true },
      });
      if (existing) continue;
      await this.prisma.contactIdentity.create({
        data: {
          contactId: current.id,
          channel: x.channel,
          handle: x.raw.trim(),
          normalizedHandle: normalized,
          displayName: provided || current.name,
          verified: x.channel !== Channel.EMAIL,
        },
      });
    }

    return current;
  }

  private async routeOwner(tx: Prisma.TransactionClient, ev: NormalizedInboundEvent, contact: Contact): Promise<string | null> {
    const rules = await tx.routingRule.findMany({ where: { enabled: true }, orderBy: { priorityOrder: 'asc' } });
    for (const r of rules) {
      if (r.whenCountry && contact.country === r.whenCountry && r.assignToUserId) return r.assignToUserId;
      if (r.whenChannel && r.whenChannel === ev.provider && r.assignToUserId) return r.assignToUserId;
    }
    return null;
  }

  private async pickSla(tx: Prisma.TransactionClient, channel: Channel): Promise<string | null> {
    const key = SLA_KEY_BY_CHANNEL[channel] ?? 'web';
    const policy = await tx.slaPolicy.findUnique({ where: { key } });
    return policy?.id ?? null;
  }
}

/** True for the generic placeholders we assign before a visitor identifies themselves. */
function isPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n === '' || n === 'website visitor' || n === 'unknown enquirer' || n === 'unknown';
}

/** Lightweight program-interest detection from the message text. */
function detectProgram(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes('60')) return '60-Day Integration Masterclass';
  if (t.includes('14')) return '14-Day Foundations Program';
  if (t.includes('28') || t.includes('reset')) return '28-Day Personal Reset';
  return undefined;
}
