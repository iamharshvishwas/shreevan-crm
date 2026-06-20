import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WaSendResult {
  delivered: boolean;
  simulated: boolean;
  detail: string;
  externalMessageId?: string;
}

export interface SlotButton {
  id: string;    // payload, max 256 chars (we encode "book|<ISO>")
  title: string; // shown to user, max 20 chars
}

/**
 * WhatsApp Cloud API (Meta Graph). Live when WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID
 * are set; otherwise records sends as simulated (same pattern as EmailProvider).
 *
 * WhatsApp policy: free-form messages are only allowed inside the 24h customer
 * service window (i.e. after the user messages us). First contact / outside the
 * window MUST use a pre-approved template.
 */
@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  isLive(): boolean {
    return !!(this.config.get<string>('WHATSAPP_TOKEN') && this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
  }

  private endpoint(): string {
    const v = this.config.get<string>('META_GRAPH_VERSION') ?? 'v21.0';
    const id = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    return `https://graph.facebook.com/${v}/${id}/messages`;
  }

  private async post(payload: Record<string, unknown>, label: string): Promise<WaSendResult> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    if (!this.isLive()) {
      this.logger.log(`[simulated whatsapp] ${label}: ${JSON.stringify(payload).slice(0, 160)}`);
      return { delivered: false, simulated: true, detail: 'Recorded locally — set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID to send.' };
    }
    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`WhatsApp ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`WhatsApp send failed (${res.status}).`);
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { delivered: true, simulated: false, detail: 'Sent via WhatsApp Cloud API.', externalMessageId: data.messages?.[0]?.id };
  }

  /** Free-form text — only valid inside the 24h window. */
  sendText(to: string, body: string): Promise<WaSendResult> {
    return this.post({ to, type: 'text', text: { preview_url: false, body } }, 'text');
  }

  /** Pre-approved template — required for first contact / outside the 24h window. */
  sendTemplate(to: string, name: string, lang: string, bodyParams: string[] = []): Promise<WaSendResult> {
    const components = bodyParams.length
      ? [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: t })) }]
      : undefined;
    return this.post(
      { to, type: 'template', template: { name, language: { code: lang }, ...(components ? { components } : {}) } },
      `template:${name}`,
    );
  }

  /** Interactive reply buttons (max 3) — used to offer discovery-call slots. */
  sendButtons(to: string, body: string, buttons: SlotButton[]): Promise<WaSendResult> {
    return this.post(
      {
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
        },
      },
      'buttons',
    );
  }
}
