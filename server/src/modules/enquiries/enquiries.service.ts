import { Injectable } from '@nestjs/common';
import {
  Channel, DeliveryState, EnquiryStatus, MessageDirection, Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { ConflictError, NotFoundError } from '../../common/errors/domain.errors';
import { IngestionService } from './ingestion.service';
import { EmailProvider } from '../veda/ai/email.provider';
import { WhatsAppProvider } from '../veda/channels/whatsapp.provider';
import { computeSla } from './sla.util';
import {
  AddNoteDto, ListEnquiriesDto, ManualEnquiryDto, ResponseDto, WebsiteEnquiryDto,
} from './dto/enquiries.dto';
import { normalizeEmail, normalizePhone } from '../contacts/identity.util';

const CHANNEL_LABEL_PLAIN: Partial<Record<Channel, string>> = {
  [Channel.WHATSAPP]: 'WhatsApp',
  [Channel.EMAIL]: 'Email',
  [Channel.INSTAGRAM]: 'Instagram',
  [Channel.FACEBOOK]: 'Facebook',
  [Channel.WEBSITE_FORM]: 'Website form',
  [Channel.PHONE]: 'Phone',
};

@Injectable()
export class EnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly email: EmailProvider,
    private readonly wa: WhatsAppProvider,
  ) {}

  async list(dto: ListEnquiriesDto): Promise<Paginated<unknown>> {
    const view = dto.view ?? 'needs_reply';

    // SLA-breach is computed (policy + time), so handle it in app code.
    if (view === 'sla_breached') return this.listSlaBreached(dto);

    const where: Prisma.EnquiryWhereInput = {};
    if (view === 'needs_reply') where.status = EnquiryStatus.NEEDS_REPLY;
    else if (view === 'waiting_for_customer') where.status = EnquiryStatus.WAITING_FOR_CUSTOMER;
    else if (view === 'unassigned') {
      where.ownerId = null;
      where.status = { in: [EnquiryStatus.NEEDS_REPLY, EnquiryStatus.WAITING_FOR_CUSTOMER] };
    } else where.status = { not: EnquiryStatus.SPAM };

    // Website live chats live in the dedicated Live Chat tab, not Enquiries.
    if (dto.channel && dto.channel !== Channel.WEBSITE_CHAT) where.channel = dto.channel;
    else where.channel = { not: Channel.WEBSITE_CHAT };
    if (dto.ownerId) where.ownerId = dto.ownerId;
    if (dto.priority) where.priority = dto.priority;
    if (dto.q) {
      where.OR = [
        { contact: { name: { contains: dto.q, mode: 'insensitive' } } },
        { conversations: { some: { subject: { contains: dto.q, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.enquiry.findMany({
        where,
        include: { contact: { select: { name: true, country: true } }, _count: { select: { conversations: true } } },
        orderBy: [{ firstRespondedAt: { sort: 'asc', nulls: 'first' } }, { lastInboundAt: 'desc' }],
        skip: dto.skip,
        take: dto.pageSize,
      }),
      this.prisma.enquiry.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  private async listSlaBreached(dto: ListEnquiriesDto): Promise<Paginated<unknown>> {
    const rows = await this.prisma.enquiry.findMany({
      where: { status: EnquiryStatus.NEEDS_REPLY, firstRespondedAt: null, channel: { not: Channel.WEBSITE_CHAT } },
      include: { contact: { select: { name: true, country: true } }, slaPolicy: true },
      orderBy: { lastInboundAt: 'asc' },
    });
    const breached = rows.filter((e) => computeSla(e, e.slaPolicy).state === 'breached');
    const total = breached.length;
    const page = breached.slice(dto.skip, dto.skip + dto.pageSize);
    return paginate(page, total, dto);
  }

  async get(id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: {
        contact: { include: { identities: true } },
        owner: { select: { id: true, name: true } },
        slaPolicy: true,
        tags: true,
        notes: { orderBy: { createdAt: 'desc' } },
        conversations: { include: { messages: { orderBy: { occurredAt: 'asc' } } } },
        lead: { select: { id: true, stageId: true } },
      },
    });
    if (!enquiry) throw new NotFoundError('Enquiry', id);
    const sla = computeSla(enquiry, enquiry.slaPolicy);
    return { ...enquiry, sla };
  }

  async assign(id: string, ownerId: string, actorId: string) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundError('User', ownerId);
    const enquiry = await this.prisma.enquiry.update({
      where: { id },
      data: {
        ownerId,
        status: EnquiryStatus.NEEDS_REPLY,
        assignments: { create: { byUserId: actorId, toOwnerId: ownerId } },
      },
    });
    await this.audit(actorId, 'ENQUIRY_ASSIGNED', 'Enquiry', id, { ownerId });
    await this.prisma.notification.create({
      data: { userId: ownerId, type: 'ENQUIRY_ASSIGNED', title: 'Enquiry assigned to you', entityType: 'Enquiry', entityId: id },
    });
    return enquiry;
  }

  async setStatus(id: string, status: EnquiryStatus, actorId: string) {
    const enquiry = await this.prisma.enquiry.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'ENQUIRY_STATUS', 'Enquiry', id, { status });
    return enquiry;
  }

  async addNote(id: string, dto: AddNoteDto, actor: { id: string; email: string }) {
    await this.ensureExists(id);
    return this.prisma.internalNote.create({
      data: { enquiryId: id, authorId: actor.id, authorName: actor.email, body: dto.body },
    });
  }

  async addTag(id: string, tag: string) {
    await this.ensureExists(id);
    return this.prisma.enquiryTag.upsert({
      where: { enquiryId_tag: { enquiryId: id, tag } },
      update: {},
      create: { enquiryId: id, tag },
    });
  }

  /** Record an outbound response. Live delivery requires a connected provider;
   *  otherwise it is stored as a manual log. */
  async respond(id: string, dto: ResponseDto, actor: { id: string; email: string }) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: {
        conversations: { orderBy: { updatedAt: 'desc' }, take: 1 },
        contact: { include: { identities: true } },
      },
    });
    if (!enquiry) throw new NotFoundError('Enquiry', id);
    const conversation = enquiry.conversations[0];
    if (!conversation) throw new ConflictError('NO_CONVERSATION', 'This enquiry has no conversation to reply to.');

    // Actually deliver on connected channels (WhatsApp / Email); otherwise the
    // reply is recorded as an internal log. Sending never throws to the caller —
    // a failure is captured and the message is still logged.
    let delivery: DeliveryState = DeliveryState.LOGGED;
    let detail = `Recorded as an internal log — ${CHANNEL_LABEL_PLAIN[enquiry.channel] ?? enquiry.channel} has no connected outbound.`;
    try {
      if (enquiry.channel === Channel.WHATSAPP && this.wa.isLive()) {
        const phone = enquiry.contact?.identities.find((i) => i.channel === Channel.WHATSAPP)?.handle;
        if (!phone) { detail = 'No WhatsApp number on file — recorded as a log.'; }
        else {
          const r = await this.wa.sendText(phone, dto.body);
          delivery = r.delivered ? DeliveryState.SENT : DeliveryState.LOGGED;
          detail = r.delivered ? 'Sent on WhatsApp.' : r.detail;
        }
      } else if (enquiry.channel === Channel.EMAIL && this.email.isLive()) {
        const to = enquiry.contact?.identities.find((i) => i.channel === Channel.EMAIL)?.handle;
        if (!to) { detail = 'No email address on file — recorded as a log.'; }
        else {
          const r = await this.email.send({ to, subject: 'Re: your enquiry with Shreevan Wellness', body: dto.body });
          delivery = r.delivered ? DeliveryState.SENT : DeliveryState.LOGGED;
          detail = r.delivered ? 'Sent by email.' : r.detail;
        }
      }
    } catch (e) {
      delivery = DeliveryState.LOGGED;
      detail = `Could not send (${(e as Error).message}) — recorded as a log.`;
    }

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: MessageDirection.OUTBOUND,
          channel: enquiry.channel,
          authorName: actor.email,
          body: dto.body,
          delivery,
          occurredAt: new Date(),
        },
      }),
      this.prisma.enquiry.update({
        where: { id },
        data: { firstRespondedAt: enquiry.firstRespondedAt ?? new Date(), status: EnquiryStatus.WAITING_FOR_CUSTOMER, lastMessageAt: new Date() },
      }),
    ]);
    return { delivery, detail };
  }

  /** Manual phone/walk-in enquiry — runs through the same ingestion pipeline. */
  async createManual(dto: ManualEnquiryDto) {
    const connection = await this.connectionForChannel(dto.channel);
    const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.ingestion.ingest({
      provider: dto.channel,
      connectionId: connection.id,
      externalEventId: id,
      externalConversationId: id,
      externalMessageId: id,
      direction: 'inbound',
      sender: { providerIdentityId: dto.phone || dto.email || id, displayName: dto.name, email: dto.email ?? null, phone: dto.phone ?? null },
      message: { type: 'text', text: dto.message, attachments: [] },
      attribution: { firstTouchSource: dto.channel, campaign: null },
      occurredAt: new Date().toISOString(),
      rawPayload: { manual: true, country: dto.country, programInterest: dto.programInterest },
    });
  }

  /** Public website form ingestion. */
  async createWebsite(dto: WebsiteEnquiryDto) {
    const connection = await this.connectionForChannel(Channel.WEBSITE_FORM);
    const id = dto.formId ? `web_${dto.formId}` : `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.ingestion.ingest({
      provider: Channel.WEBSITE_FORM,
      connectionId: connection.id,
      externalEventId: id,
      externalConversationId: id,
      externalMessageId: id,
      direction: 'inbound',
      sender: {
        providerIdentityId: normalizeEmail(dto.email) || normalizePhone(dto.phone) || id,
        displayName: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
      },
      message: { type: 'text', text: dto.message, attachments: [] },
      attribution: { firstTouchSource: Channel.WEBSITE_FORM, campaign: null },
      occurredAt: new Date().toISOString(),
      rawPayload: { country: dto.country, programInterest: dto.programInterest },
    });
  }

  /**
   * Flexible website-form intake — accepts ANY form's fields. Recognises the
   * common ones (name/email/phone/message/country/program), preserves the rest
   * in the message, tags it with the form name, and runs it through ingestion so
   * it lands in Enquiries. Honeypot field → silently ignored (bot).
   */
  async createFormSubmission(body: Record<string, unknown>) {
    const str = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = body[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return undefined;
    };

    // Honeypot: bots fill hidden fields. Pretend success, but don't ingest.
    if (str('_hp', 'honeypot', '_gotcha', 'bot_field')) return { ok: true };

    const name = str('name', 'full_name', 'fullName', 'Name') ?? 'Website enquiry';
    const email = str('email', 'Email', 'emailAddress', 'email_address');
    const phone = str('phone', 'Phone', 'phone_number', 'phoneNumber', 'mobile', 'contact');
    const message = str('message', 'Message', 'enquiry', 'comments', 'comment', 'details', 'query', 'notes');
    const country = str('country', 'Country');
    const program = str('program', 'programInterest', 'program_interest', 'interest');
    const formName = str('form', 'formName', 'form_name', 'formId', 'form_id', 'subject') ?? 'Website form';

    const handled = new Set([
      '_hp', 'honeypot', '_gotcha', 'bot_field', 'name', 'full_name', 'fullName', 'Name',
      'email', 'Email', 'emailAddress', 'email_address', 'phone', 'Phone', 'phone_number',
      'phoneNumber', 'mobile', 'contact', 'message', 'Message', 'enquiry', 'comments', 'comment',
      'details', 'query', 'notes', 'country', 'Country', 'program', 'programInterest',
      'program_interest', 'interest', 'form', 'formName', 'form_name', 'formId', 'form_id', 'subject',
    ]);
    const extras = Object.entries(body)
      .filter(([k, v]) => !handled.has(k) && typeof v === 'string' && (v as string).trim())
      .map(([k, v]) => `${k}: ${(v as string).trim()}`);

    const fullMessage = [
      message,
      program ? `Program interest: ${program}` : '',
      ...extras,
    ].filter(Boolean).join('\n') || `New submission from "${formName}".`;

    const connection = await this.connectionForChannel(Channel.WEBSITE_FORM);
    const id = `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.ingestion.ingest({
      provider: Channel.WEBSITE_FORM,
      connectionId: connection.id,
      externalEventId: id,
      externalConversationId: normalizeEmail(email) || normalizePhone(phone) || id,
      externalMessageId: id,
      direction: 'inbound',
      sender: { providerIdentityId: normalizeEmail(email) || normalizePhone(phone) || id, displayName: name, email: email ?? null, phone: phone ?? null },
      message: { type: 'text', text: fullMessage, attachments: [] },
      attribution: { firstTouchSource: Channel.WEBSITE_FORM, campaign: formName },
      occurredAt: new Date().toISOString(),
      rawPayload: { form: formName, country, program, fields: body },
    });
    return { ok: true };
  }

  /** Handoff: create a follow-up task linked to the enquiry (managed in Tasks). */
  async createTask(id: string, input: { title: string; type?: string; dueAt?: string }, actorId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundError('Enquiry', id);
    return this.prisma.task.create({
      data: {
        type: input.type ?? 'Follow-up',
        title: input.title,
        ownerId: enquiry.ownerId ?? actorId,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        enquiryId: id,
        contactId: enquiry.contactId,
      },
    });
  }

  /** Handoff: schedule a discovery call (managed in Discovery calls). */
  async scheduleCall(id: string, input: { scheduledAt: string; timezone: string; prepNotes?: string }, actorId: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundError('Enquiry', id);
    const call = await this.prisma.discoveryCall.create({
      data: {
        enquiryId: id,
        contactId: enquiry.contactId,
        ownerId: enquiry.ownerId ?? actorId,
        scheduledAt: new Date(input.scheduledAt),
        timezone: input.timezone,
        prepNotes: input.prepNotes,
      },
    });
    await this.prisma.enquiryTag.upsert({
      where: { enquiryId_tag: { enquiryId: id, tag: 'discovery-call' } },
      update: {},
      create: { enquiryId: id, tag: 'discovery-call' },
    });
    return call;
  }

  private async connectionForChannel(channel: Channel) {
    const connection = await this.prisma.channelConnection.findFirst({ where: { channel } });
    if (connection) return connection;
    return this.prisma.channelConnection.create({
      data: { channel, label: `${channel} (auto)`, status: 'CONNECTED', inboundEnabled: true, outboundEnabled: channel === Channel.PHONE || channel === Channel.WALKIN },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.enquiry.count({ where: { id } });
    if (!exists) throw new NotFoundError('Enquiry', id);
  }

  private audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
  }
}
