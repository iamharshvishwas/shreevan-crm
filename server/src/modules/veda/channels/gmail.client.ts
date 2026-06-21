import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}
export interface GmailMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

/**
 * Thin Gmail API client (HTTPS) for reading the inbox. Reuses the same OAuth
 * credentials as outbound sending — but the refresh token must also carry the
 * gmail.modify scope (read + mark-as-read) for inbound to work.
 */
@Injectable()
export class GmailClient {
  private readonly logger = new Logger(GmailClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>('GMAIL_CLIENT_ID') &&
      this.config.get<string>('GMAIL_CLIENT_SECRET') &&
      this.config.get<string>('GMAIL_REFRESH_TOKEN')
    );
  }

  async accessToken(): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get<string>('GMAIL_CLIENT_ID')!,
        client_secret: this.config.get<string>('GMAIL_CLIENT_SECRET')!,
        refresh_token: this.config.get<string>('GMAIL_REFRESH_TOKEN')!,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.error(`Gmail token ${res.status}: ${t.slice(0, 200)}`);
      throw new Error('Gmail OAuth token refresh failed.');
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('Gmail OAuth returned no access token.');
    return data.access_token;
  }

  /** List message ids matching a Gmail search query (e.g. unread inbox). */
  async listIds(token: string, query: string, max = 10): Promise<string[]> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.error(`Gmail list ${res.status}: ${t.slice(0, 200)}`);
      throw new Error(`Gmail list failed (${res.status}).`);
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return (data.messages ?? []).map((m) => m.id);
  }

  async getMessage(token: string, id: string): Promise<GmailMessage> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Gmail get failed (${res.status}).`);
    return (await res.json()) as GmailMessage;
  }

  /** Remove the UNREAD label so the message isn't processed again. */
  async markRead(token: string, id: string): Promise<void> {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }).catch(() => undefined);
  }
}

/** Pull a header value (case-insensitive) from a Gmail message payload. */
export function gmailHeader(msg: GmailMessage, name: string): string | undefined {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value;
}

/** Find the text/plain body in the MIME tree and decode it. Falls back to snippet-less ''. */
export function extractPlainText(part?: GmailPart): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeB64Url(part.body.data);
  }
  for (const p of part.parts ?? []) {
    const t = extractPlainText(p);
    if (t) return t;
  }
  // Fallback: a top-level body with data (e.g. simple messages).
  if (part.body?.data) return decodeB64Url(part.body.data);
  return '';
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
