import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Channel, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IngestionService } from '../../enquiries/ingestion.service';
import { NormalizedInboundEvent } from '../../enquiries/dto/inbound-event.dto';
import { VedaChatService } from '../agents/veda-chat.service';
import { Public } from '../../../common/auth/decorators';
import { ChatMessageDto } from '../dto/veda.dto';

const FALLBACK_REPLY = 'Thank you for reaching out to Shreevan Wellness 🌿 Our team will get back to you very shortly.';

/**
 * Public website live-chat endpoint. Each visitor message becomes a tracked
 * WEBSITE_CHAT enquiry (via the shared ingestion pipeline), then Veda replies.
 * The embeddable widget (public/veda-widget.js) calls this.
 */
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly chat: VedaChatService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('message')
  async message(@Body() dto: ChatMessageDto): Promise<{ reply: string; conversationId?: string }> {
    const connectionId = await this.getConnectionId();

    const ev: NormalizedInboundEvent = {
      provider: Channel.WEBSITE_CHAT,
      connectionId,
      externalEventId: randomUUID(),
      externalMessageId: randomUUID(),
      externalConversationId: dto.sessionId,
      direction: 'inbound',
      sender: {
        providerIdentityId: dto.sessionId,
        displayName: dto.name?.trim() || 'Website visitor',
        email: dto.email?.trim() || null,
        phone: null,
      },
      message: { type: 'text', text: dto.message },
      attribution: { firstTouchSource: Channel.WEBSITE_CHAT, campaign: null },
      occurredAt: new Date().toISOString(),
      rawPayload: { sessionId: dto.sessionId },
    };

    const result = await this.ingestion.ingest(ev);
    if (!result.conversationId) return { reply: FALLBACK_REPLY };

    const { reply } = await this.chat.respond(result.conversationId);
    return { reply: reply ?? FALLBACK_REPLY, conversationId: result.conversationId };
  }

  private async getConnectionId(): Promise<string> {
    const existing = await this.prisma.channelConnection.findFirst({ where: { channel: Channel.WEBSITE_CHAT } });
    if (existing) return existing.id;
    const created = await this.prisma.channelConnection.create({
      data: { channel: Channel.WEBSITE_CHAT, label: 'Website live chat (Veda)', status: ConnectionStatus.CONNECTED, inboundEnabled: true, outboundEnabled: true },
    });
    return created.id;
  }
}
