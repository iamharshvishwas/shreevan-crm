import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Channel, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IngestionService } from '../../enquiries/ingestion.service';
import { NormalizedInboundEvent } from '../../enquiries/dto/inbound-event.dto';
import { normalizePhone } from '../../contacts/identity.util';

export interface NormalizedLead {
  source: Channel;          // first-touch attribution (GOOGLE_ADS, LINKEDIN, …)
  name: string;
  email?: string | null;
  phone?: string | null;
  campaign?: string | null;
  externalId?: string;      // provider lead id (idempotency)
  extra?: Record<string, string>; // remaining form fields, shown in the first message
}

@Injectable()
export class LeadIntakeService {
  private readonly logger = new Logger(LeadIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  /**
   * Ingest a lead from any ad source. First-touch attribution is preserved as
   * the ad source, but the live conversation routes to a channel Veda can ACT on
   * (WhatsApp if a phone is present, else email) — mirroring the Meta Lead Ads flow.
   */
  async ingestLead(lead: NormalizedLead): Promise<void> {
    const phone = lead.phone ? normalizePhone(lead.phone) : null;
    const email = lead.email?.trim().toLowerCase() || null;

    const provider = phone ? Channel.WHATSAPP : email ? Channel.EMAIL : lead.source;
    const providerIdentityId = phone ?? email ?? `lead:${lead.externalId ?? randomUUID()}`;
    const connectionId = await this.getConnectionId(lead.source);

    const summary = Object.entries(lead.extra ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const sourceLabel = SOURCE_LABEL[lead.source] ?? lead.source;

    const ev: NormalizedInboundEvent = {
      provider,
      connectionId,
      externalEventId: lead.externalId ? `${lead.source}:${lead.externalId}` : randomUUID(),
      externalMessageId: lead.externalId ? `${lead.source}:${lead.externalId}` : randomUUID(),
      externalConversationId: providerIdentityId,
      direction: 'inbound',
      sender: { providerIdentityId, displayName: lead.name || `${sourceLabel} lead`, email, phone },
      message: { type: 'text', text: `New lead from ${sourceLabel}.${summary ? ` ${summary}` : ''}` },
      attribution: { firstTouchSource: lead.source, campaign: lead.campaign ?? sourceLabel },
      occurredAt: new Date().toISOString(),
      rawPayload: { source: lead.source, extra: lead.extra },
    };
    await this.ingestion.ingest(ev);
  }

  private async getConnectionId(channel: Channel): Promise<string> {
    const existing = await this.prisma.channelConnection.findFirst({ where: { channel } });
    if (existing) return existing.id;
    const created = await this.prisma.channelConnection.create({
      data: {
        channel,
        label: `${SOURCE_LABEL[channel] ?? channel} (Veda)`,
        status: ConnectionStatus.CONNECTED,
        inboundEnabled: true,
        outboundEnabled: false,
      },
    });
    return created.id;
  }
}

const SOURCE_LABEL: Partial<Record<Channel, string>> = {
  GOOGLE_ADS: 'Google Ads',
  LINKEDIN: 'LinkedIn Ads',
  FACEBOOK: 'Meta Ads',
  INSTAGRAM: 'Instagram Ads',
  WHATSAPP: 'WhatsApp Ad',
};
