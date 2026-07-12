import { Channel } from '@prisma/client';

export const normalizeEmail = (e?: string | null): string =>
  e ? e.trim().toLowerCase() : '';

/** Best-effort E.164-ish normalization: keep digits and a leading +, 00 → +.
 *  Bare Indian mobiles are canonicalized to +91 so the same person typing
 *  "8755548899" and "+91 87555 48899" resolves to ONE identity — and so
 *  WhatsApp sends always carry a country code (Meta rejects bare numbers). */
export const normalizePhone = (p?: string | null): string => {
  if (!p) return '';
  const cleaned = p.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;   // 10-digit Indian mobile
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;   // 91-prefixed, no +
  return cleaned;
};

/** Normalized key used for the unique (channel, normalizedHandle) match. */
export function normalizeHandle(channel: Channel, handle: string): string {
  switch (channel) {
    case Channel.EMAIL:
      return normalizeEmail(handle);
    case Channel.WHATSAPP:
    case Channel.PHONE:
      return normalizePhone(handle);
    default:
      return handle.trim().toLowerCase();
  }
}

const EMAIL_IN_TEXT_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Optional +91/91 prefix, then a 10-digit mobile number written either solid
// ("8755548866") or grouped in fives ("98470 12233" / "98470-12233").
const INDIAN_MOBILE_IN_TEXT_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/;

/** Best-effort email/phone pickup from free text — for channels (live chat)
 *  where a visitor may state their details in a message instead of a form field. */
export function extractContactFromText(text: string): { email: string | null; phone: string | null } {
  return {
    email: text.match(EMAIL_IN_TEXT_RE)?.[0] ?? null,
    phone: text.match(INDIAN_MOBILE_IN_TEXT_RE)?.[0] ?? null,
  };
}
