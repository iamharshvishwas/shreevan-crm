import { Channel } from '@prisma/client';
import { extractContactFromText, normalizeEmail, normalizeHandle, normalizePhone } from './identity.util';

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

describe('extractContactFromText', () => {
  it('picks up email + WhatsApp number a visitor states in a chat message (live-chat bug repro)', () => {
    const text = 'Naina name h and whatsapp number 8755548866 email ID is nainasinghvishwas@gmail.com';
    expect(extractContactFromText(text)).toEqual({ email: 'nainasinghvishwas@gmail.com', phone: '8755548866' });
  });

  it('matches an email-only message', () => {
    expect(extractContactFromText('reach me at maya.kapoor@example.com please')).toEqual({ email: 'maya.kapoor@example.com', phone: null });
  });

  it('matches a phone with a +91 prefix, grouped in fives', () => {
    expect(extractContactFromText('call me on +91 98470 12233')).toEqual({ email: null, phone: '+91 98470 12233' });
  });

  it('returns nulls when the message has no contact details', () => {
    expect(extractContactFromText('What is included in the 28-day program?')).toEqual({ email: null, phone: null });
  });
});
