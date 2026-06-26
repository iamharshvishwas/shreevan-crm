import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IngestionService } from '../../enquiries/ingestion.service';
import { NormalizedInboundEvent } from '../../enquiries/dto/inbound-event.dto';
import { normalizeHandle, normalizePhone } from '../../contacts/identity.util';
import { VedaLogService } from '../veda-log.service';
import { WhatsAppProvider } from './whatsapp.provider';
import { VedaChatService } from '../agents/veda-chat.service';
import { formatIst } from './slots.util';

// Minimal shapes for the WhatsApp Cloud API webhook payload we consume.
interface WaContact { wa_id: string; profile?: { name?: string } }
interface WaButtonReply { id: string; title: string }
interface WaReferral { source_type?: string; source_id?: string; headline?: string; body?: string; ctwa_clid?: string }
interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: WaButtonReply; list_reply?: WaButtonReply };
  button?: { text: string; payload: string };
  referral?: WaReferral; // present on click-to-WhatsApp ad messages
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ingestion: IngestionService,
    private readonly wa: WhatsAppProvider,
    private readonly logs: VedaLogService,
    private readonly chat: VedaChatService,
  ) {}

  /** Entry point for a verified WhatsApp webhook POST. */
  async processWhatsApp(payload: Record<string, unknown>): Promise<void> {
    const entries = (payload.entry as Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>) ?? [];
    const connectionId = await this.getConnectionId();

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = (value.contacts as WaContact[]) ?? [];
        const messages = (value.messages as WaMessage[]) ?? [];
        const nameByWaId = new Map(contacts.map((c) => [c.wa_id, c.profile?.name ?? 'WhatsApp contact']));

        for (const msg of messages) {
          try {
            await this.handleMessage(msg, nameByWaId.get(msg.from) ?? 'WhatsApp contact', connectionId);
          } catch (e) {
            this.logger.error(`WhatsApp message ${msg.id} failed: ${(e as Error).message}`);
          }
        }
        // Delivery/read status updates (value.statuses) are ignored for now.
      }
    }
  }

  private async handleMessage(msg: WaMessage, displayName: string, connectionId: string): Promise<void> {
    // Interactive slot selection → book a discovery call.
    const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
    if (reply?.id?.startsWith('book|')) {
      await this.bookSlot(msg.from, reply.id.slice(5), displayName);
      // Also record their choice in the conversation for context.
      await this.ingestText(msg, displayName, connectionId, `📅 Selected slot: ${reply.title}`);
      return;
    }

    let text =
      msg.text?.body ??
      reply?.title ??
      msg.button?.text ??
      `[${msg.type} message]`;

    // Click-to-WhatsApp ad: prepend the ad context so it's attributed + Veda sees it.
    if (msg.referral?.source_type === 'ad' || msg.referral?.headline) {
      const ad = msg.referral;
      text = `📣 From WhatsApp Ad${ad?.headline ? `: "${ad.headline}"` : ''}\n${text}`;
    }

    const conversationId = await this.ingestText(msg, displayName, connectionId, text);

    // Veda replies conversationally (we're inside the 24h window since they just messaged).
    if (conversationId) {
      const { reply: vedaReply } = await this.chat.respond(conversationId);
      if (vedaReply) await this.wa.sendText(msg.from, vedaReply).catch(() => undefined);
    }
  }

  private async ingestText(msg: WaMessage, displayName: string, connectionId: string, text: string): Promise<string | undefined> {
    const phone = normalizePhone(msg.from);
    const ev: NormalizedInboundEvent = {
      provider: Channel.WHATSAPP,
      connectionId,
      externalEventId: msg.id,
      externalMessageId: msg.id,
      externalConversationId: phone,
      direction: 'inbound',
      sender: { providerIdentityId: phone, displayName, email: null, phone },
      message: { type: 'text', text },
      attribution: { firstTouchSource: Channel.WHATSAPP, campaign: null },
      occurredAt: new Date(Number(msg.timestamp) * 1000).toISOString(),
      rawPayload: msg as unknown as Record<string, unknown>,
    };
    const result = await this.ingestion.ingest(ev);
    return result.conversationId;
  }

  /** Book a discovery call from a slot the client tapped, then confirm on WhatsApp. */
  private async bookSlot(fromWaId: string, iso: string, displayName: string): Promise<void> {
    const started = Date.now();
    const phone = normalizePhone(fromWaId);
    const identity = await this.prisma.contactIdentity.findUnique({
      where: { channel_normalizedHandle: { channel: Channel.WHATSAPP, normalizedHandle: normalizeHandle(Channel.WHATSAPP, phone) } },
      include: { contact: { include: { leads: { where: { confirmedAt: null, closedLostAt: null }, orderBy: { updatedAt: 'desc' }, take: 1 }, enquiries: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
    });

    const scheduledAt = new Date(iso);
    if (isNaN(scheduledAt.getTime())) return;

    const contact = identity?.contact;
    const lead = contact?.leads[0];
    const enquiry = contact?.enquiries[0];

    const call = await this.prisma.discoveryCall.create({
      data: {
        contactId: contact?.id,
        leadId: lead?.id,
        enquiryId: enquiry?.id,
        ownerId: lead?.ownerId ?? enquiry?.ownerId ?? undefined,
        scheduledAt,
        timezone: contact?.timezone ?? 'Asia/Kolkata',
        status: 'SCHEDULED',
        prepNotes: 'Booked by the client via WhatsApp (Veda).',
      },
    });

    if (lead) {
      await this.prisma.leadActivity.create({
        data: { leadId: lead.id, type: 'VEDA', title: 'Discovery call booked via WhatsApp', body: formatIst(iso) },
      }).catch(() => undefined);
    }

    await this.wa.sendText(fromWaId, `Wonderful, ${displayName.split(' ')[0]}! Your discovery call is confirmed for ${formatIst(iso)}. We look forward to speaking with you. 🌿\n— Veda, Shreevan Wellness`).catch(() => undefined);

    await this.logs.write({
      type: 'WHATSAPP_BOOKING', status: 'COMPLETED', entityType: 'DiscoveryCall', entityId: call.id,
      output: { scheduledAt: iso, contactId: contact?.id } as object, durationMs: Date.now() - started, completedAt: new Date(),
    });
  }

  // -------------------------------------------------------------------------
  // Meta Lead Ads (Facebook / Instagram) — leadgen webhook
  // -------------------------------------------------------------------------

  async processLeadgen(payload: Record<string, unknown>): Promise<void> {
    const entries = (payload.entry as Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }>) ?? [];
    const connectionId = await this.getConnectionId(Channel.FACEBOOK, 'Meta Lead Ads');

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue;
        const v = change.value ?? {};
        try {
          await this.handleLead(String(v.leadgen_id), connectionId);
        } catch (e) {
          this.logger.error(`Leadgen ${String(v.leadgen_id)} failed: ${(e as Error).message}`);
        }
      }
    }
  }

  private async handleLead(leadgenId: string, connectionId: string): Promise<void> {
    if (!leadgenId || leadgenId === 'undefined') return;
    const fields = await this.fetchLeadFields(leadgenId);

    const name = fields['full_name'] ?? fields['name'] ?? 'Meta lead';
    const email = fields['email'] ?? null;
    const phoneRaw = fields['phone_number'] ?? fields['phone'] ?? null;
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

    // Route through the current channel where Veda can act: WhatsApp if a phone
    // is present, else email. First-touch attribution stays as the ad (Facebook).
    const provider = phone ? Channel.WHATSAPP : email ? Channel.EMAIL : Channel.FACEBOOK;
    const providerIdentityId = phone ?? email ?? `lead:${leadgenId}`;

    const summary = Object.entries(fields)
      .filter(([k]) => !['email', 'phone', 'phone_number', 'full_name', 'name'].includes(k))
      .map(([k, val]) => `${k}: ${val}`)
      .join(' · ');

    const ev: NormalizedInboundEvent = {
      provider,
      connectionId,
      externalEventId: `leadgen:${leadgenId}`,
      externalMessageId: `leadgen:${leadgenId}`,
      externalConversationId: providerIdentityId,
      direction: 'inbound',
      sender: { providerIdentityId, displayName: name, email, phone },
      message: { type: 'text', text: `New lead from a Meta ad.${summary ? ` ${summary}` : ''}` },
      attribution: { firstTouchSource: Channel.FACEBOOK, campaign: 'Meta Lead Ad' },
      occurredAt: new Date().toISOString(),
      rawPayload: { leadgenId, fields },
    };
    await this.ingestion.ingest(ev);
  }

  private async fetchLeadFields(leadgenId: string): Promise<Record<string, string>> {
    const usingPageToken = !!this.config.get<string>('META_PAGE_TOKEN');
    const token = this.config.get<string>('META_PAGE_TOKEN') ?? this.config.get<string>('WHATSAPP_TOKEN');
    const v = this.config.get<string>('META_GRAPH_VERSION') ?? 'v21.0';
    if (!token) { this.logger.error('Leadgen fetch skipped: no META_PAGE_TOKEN/WHATSAPP_TOKEN set'); return {}; }
    const res = await fetch(`https://graph.facebook.com/${v}/${leadgenId}?fields=field_data&access_token=${token}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Leadgen fetch ${res.status} for ${leadgenId} (token=${usingPageToken ? 'META_PAGE_TOKEN' : 'WHATSAPP_TOKEN'}): ${body.slice(0, 300)}`);
      return {};
    }
    const data = (await res.json()) as { field_data?: Array<{ name: string; values: string[] }> };
    const out: Record<string, string> = {};
    for (const f of data.field_data ?? []) out[f.name] = (f.values ?? []).join(', ');
    return out;
  }

  // -------------------------------------------------------------------------

  /** Find (or lazily create) the ChannelConnection row for a Meta channel. */
  private async getConnectionId(channel: Channel = Channel.WHATSAPP, label = 'WhatsApp Business'): Promise<string> {
    const existing = await this.prisma.channelConnection.findFirst({ where: { channel } });
    if (existing) return existing.id;
    const created = await this.prisma.channelConnection.create({
      data: { channel, label, status: ConnectionStatus.CONNECTED, inboundEnabled: true, outboundEnabled: true },
    });
    return created.id;
  }
}
