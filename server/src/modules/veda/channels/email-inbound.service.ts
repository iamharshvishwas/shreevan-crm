import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Channel, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IngestionService } from '../../enquiries/ingestion.service';
import { NormalizedInboundEvent } from '../../enquiries/dto/inbound-event.dto';
import { VedaChatService } from '../agents/veda-chat.service';
import { EmailProvider } from '../ai/email.provider';
import { VedaLogService } from '../veda-log.service';

export interface InboundEmail {
  fromEmail: string;
  fromName?: string;
  subject?: string;
  text: string;
  messageId?: string;
}

@Injectable()
export class EmailInboundService {
  private readonly logger = new Logger(EmailInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly chat: VedaChatService,
    private readonly email: EmailProvider,
    private readonly logs: VedaLogService,
  ) {}

  /** Ingest an inbound email as an EMAIL enquiry, then send Veda's reply. */
  async handle(mail: InboundEmail): Promise<void> {
    if (!mail.fromEmail || !mail.text?.trim()) return;

    const connectionId = await this.getConnectionId();
    const ev: NormalizedInboundEvent = {
      provider: Channel.EMAIL,
      connectionId,
      externalEventId: mail.messageId || randomUUID(),
      externalMessageId: mail.messageId || randomUUID(),
      externalConversationId: mail.fromEmail.toLowerCase(), // thread per sender
      direction: 'inbound',
      sender: {
        providerIdentityId: mail.fromEmail.toLowerCase(),
        displayName: mail.fromName?.trim() || mail.fromEmail,
        email: mail.fromEmail,
        phone: null,
      },
      message: { type: 'text', text: mail.text },
      attribution: { firstTouchSource: Channel.EMAIL, campaign: null },
      occurredAt: new Date().toISOString(),
      rawPayload: { subject: mail.subject } as Record<string, unknown>,
    };

    const result = await this.ingestion.ingest(ev);
    if (result.status === 'duplicate' || !result.conversationId) return;

    const { reply } = await this.chat.respond(result.conversationId);
    if (!reply) return;

    const subject = mail.subject?.trim();
    const replySubject = subject
      ? /^re:/i.test(subject) ? subject : `Re: ${subject}`
      : 'Re: your enquiry — Shreevan Wellness';

    try {
      const sent = await this.email.send({ to: mail.fromEmail, subject: replySubject, body: reply });
      await this.logs.write({
        type: 'EMAIL_REPLY_SENT', status: 'COMPLETED', entityType: 'Conversation', entityId: result.conversationId,
        output: { to: mail.fromEmail, simulated: sent.simulated } as object, completedAt: new Date(),
      });
    } catch (e) {
      await this.logs.write({
        type: 'EMAIL_REPLY_SENT', status: 'FAILED', entityType: 'Conversation', entityId: result.conversationId,
        error: (e as Error).message,
      });
    }
  }

  private async getConnectionId(): Promise<string> {
    const existing = await this.prisma.channelConnection.findFirst({ where: { channel: Channel.EMAIL } });
    if (existing) return existing.id;
    const created = await this.prisma.channelConnection.create({
      data: { channel: Channel.EMAIL, label: 'Email (Veda)', status: ConnectionStatus.CONNECTED, inboundEnabled: true, outboundEnabled: true },
    });
    return created.id;
  }
}
