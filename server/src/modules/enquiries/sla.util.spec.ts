import { SlaPolicy } from '@prisma/client';
import { computeSla } from './sla.util';

const policy = (mins: number, pause = true): SlaPolicy => ({
  id: 'p', key: 'k', label: 'l', firstResponseMins: mins, appliesTo: 'x', pauseWhenWaitingCustomer: pause, enabled: true,
});

const base = { status: 'NEEDS_REPLY' as const, firstRespondedAt: null as Date | null, lastInboundAt: new Date() };

describe('computeSla', () => {
  it('breaches when the deadline has passed', () => {
    const e = { ...base, lastInboundAt: new Date(Date.now() - 40 * 60_000) };
    expect(computeSla(e, policy(15)).state).toBe('breached');
  });

  it('warns inside the final 25% of the window', () => {
    const e = { ...base, lastInboundAt: new Date(Date.now() - 28 * 60_000) }; // 2 min left of 30
    expect(computeSla(e, policy(30)).state).toBe('warning');
  });

  it('is on track early in the window', () => {
    const e = { ...base, lastInboundAt: new Date(Date.now() - 2 * 60_000) };
    expect(computeSla(e, policy(60)).state).toBe('on_track');
  });

  it('is completed once first response is recorded', () => {
    const e = { ...base, firstRespondedAt: new Date() };
    expect(computeSla(e, policy(15)).state).toBe('completed');
  });

  it('pauses while waiting for the customer', () => {
    const e = { ...base, status: 'WAITING_FOR_CUSTOMER' as const };
    expect(computeSla(e, policy(15, true)).state).toBe('paused');
  });

  it('returns none for resolved enquiries or missing policy', () => {
    expect(computeSla({ ...base, status: 'RESOLVED' as const }, policy(15)).state).toBe('none');
    expect(computeSla(base, null).state).toBe('none');
  });
});
