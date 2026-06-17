import { Channel } from '@prisma/client';
import { normalizeEmail, normalizeHandle, normalizePhone } from './identity.util';

describe('identity normalization', () => {
  it('normalizes emails (trim + lowercase)', () => {
    expect(normalizeEmail('  Maya.Kapoor@Example.COM ')).toBe('maya.kapoor@example.com');
  });

  it('normalizes phones to E.164-ish', () => {
    expect(normalizePhone('+91 98470 12233')).toBe('+919847012233');
    expect(normalizePhone('0091-98470-12233')).toBe('+919847012233');
  });

  it('routes handle normalization by channel', () => {
    expect(normalizeHandle(Channel.EMAIL, 'A@B.com')).toBe('a@b.com');
    expect(normalizeHandle(Channel.WHATSAPP, '+91 (984) 701-2233')).toBe('+919847012233');
    expect(normalizeHandle(Channel.INSTAGRAM, '@Maya.Reset')).toBe('@maya.reset');
  });
});
