import { Channel } from '@prisma/client';

export const normalizeEmail = (e?: string | null): string =>
  e ? e.trim().toLowerCase() : '';

/** Best-effort E.164-ish normalization: keep digits and a leading +, 00 → +. */
export const normalizePhone = (p?: string | null): string =>
  p ? p.replace(/[^\d+]/g, '').replace(/^00/, '+') : '';

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
