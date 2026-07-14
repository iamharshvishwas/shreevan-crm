import { detectAttention } from './veda-chat.service';

describe('detectAttention', () => {
  it('flags a frustrated guest repeating themselves (English)', () => {
    expect(detectAttention('I already told you my number', 'Could you share your number?'))
      .toBe('Guest seems frustrated — a human should step in');
  });

  it('flags a frustrated guest repeating themselves (Hinglish)', () => {
    expect(detectAttention('mene pehle hi bata diya tha apna number', 'ok'))
      .toBe('Guest seems frustrated — a human should step in');
  });

  it('flags an explicit ask for a person', () => {
    expect(detectAttention('can I talk to a real person', 'Sure.'))
      .toBe('Client may want to speak to a person');
  });

  it('flags Veda deferring to the team', () => {
    expect(detectAttention('what is the transfer cost', 'The team will confirm the exact transfer cost.'))
      .toBe('Veda was unsure / deferred to the team');
  });

  it('stays quiet on a normal answered exchange', () => {
    expect(detectAttention('What is included in the 28 day program?', 'It includes yoga, sattvic meals and accommodation.'))
      .toBeNull();
  });
});
