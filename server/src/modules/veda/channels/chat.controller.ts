import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Channel, ConnectionStatus, DeliveryState, MessageDirection } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IngestionService } from '../../enquiries/ingestion.service';
import { NormalizedInboundEvent } from '../../enquiries/dto/inbound-event.dto';
import { VedaChatService } from '../agents/veda-chat.service';
import { Public, CurrentUser } from '../../../common/auth/decorators';
import type { AuthUser } from '../../../common/auth/auth.types';
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
  async message(@Body() dto: ChatMessageDto): Promise<{ reply: string; conversationId?: string; handover?: boolean }> {
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

    // If a human has taken this chat, don't let Veda reply — the widget will
    // poll /chat/messages and show the agent's replies as they come.
    const convo = await this.prisma.conversation.findUnique({
      where: { id: result.conversationId },
      select: { handoverToHuman: true },
    });
    if (convo?.handoverToHuman) return { reply: '', handover: true, conversationId: result.conversationId };

    const { reply } = await this.chat.respond(result.conversationId);
    return { reply: reply ?? FALLBACK_REPLY, conversationId: result.conversationId };
  }

  /** Widget polls this for new agent/Veda messages (so human takeover reaches the visitor). */
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('messages')
  async poll(@Query('sessionId') sessionId: string, @Query('since') since?: string) {
    if (!sessionId) return { messages: [] };
    const convo = await this.prisma.conversation.findFirst({
      where: { channel: Channel.WEBSITE_CHAT, externalConversationId: sessionId },
      select: { id: true },
    });
    if (!convo) return { messages: [] };
    const sinceDate = since ? new Date(since) : new Date(0);
    const messages = await this.prisma.message.findMany({
      where: { conversationId: convo.id, direction: MessageDirection.OUTBOUND, occurredAt: { gt: sinceDate } },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, body: true, occurredAt: true },
    });
    return { messages };
  }

  // --- Agent-facing live-chat inbox (authenticated) -------------------------

  @ApiBearerAuth()
  @Get('conversations')
  async listConversations() {
    const convos = await this.prisma.conversation.findMany({
      where: { channel: Channel.WEBSITE_CHAT },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        contact: { select: { name: true, country: true } },
        messages: { orderBy: { occurredAt: 'desc' }, take: 1, select: { body: true, direction: true, occurredAt: true } },
      },
    });
    return convos.map((c) => ({
      id: c.id,
      visitor: c.contact?.name ?? 'Website visitor',
      country: c.contact?.country ?? null,
      handoverToHuman: c.handoverToHuman,
      needsAttention: c.needsAttention,
      attentionReason: c.attentionReason,
      lastMessage: c.messages[0]?.body ?? '',
      lastDirection: c.messages[0]?.direction ?? null,
      lastAt: c.messages[0]?.occurredAt ?? c.updatedAt,
    }));
  }

  @ApiBearerAuth()
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const convo = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true, country: true } },
        messages: { orderBy: { occurredAt: 'asc' }, select: { id: true, body: true, direction: true, authorName: true, occurredAt: true } },
      },
    });
    if (!convo) return null;
    return {
      id: convo.id,
      visitor: convo.contact?.name ?? 'Website visitor',
      country: convo.contact?.country ?? null,
      handoverToHuman: convo.handoverToHuman,
      needsAttention: convo.needsAttention,
      attentionReason: convo.attentionReason,
      messages: convo.messages,
    };
  }

  @ApiBearerAuth()
  @Post('conversations/:id/handover')
  async setHandover(@Param('id') id: string, @Body() body: { toHuman: boolean }) {
    await this.prisma.conversation.update({
      where: { id },
      data: body.toHuman
        ? { handoverToHuman: true }
        : { handoverToHuman: false, needsAttention: false, attentionReason: null },
    });
    return { ok: true, handoverToHuman: body.toHuman };
  }

  @ApiBearerAuth()
  @Post('conversations/:id/reply')
  async agentReply(@Param('id') id: string, @Body() body: { text: string }, @CurrentUser() user: AuthUser) {
    const text = body.text?.trim();
    if (!text) return { ok: false };
    const convo = await this.prisma.conversation.findUnique({ where: { id }, select: { channel: true } });
    if (!convo) return { ok: false };

    const agent = await this.prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    await this.prisma.message.create({
      data: {
        conversationId: id,
        direction: MessageDirection.OUTBOUND,
        channel: convo.channel,
        authorName: agent?.name ?? 'Shreevan Team',
        body: text,
        delivery: DeliveryState.SENT,
        occurredAt: new Date(),
      },
    });
    // Sending a manual reply takes the chat over and clears the flag.
    await this.prisma.conversation.update({
      where: { id },
      data: { handoverToHuman: true, needsAttention: false, attentionReason: null, updatedAt: new Date() },
    });
    return { ok: true };
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
