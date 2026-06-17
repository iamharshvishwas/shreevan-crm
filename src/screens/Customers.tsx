import type { AppStore } from '../store';
import { Callout, Pill } from '../components/ui';
import { formatMoney } from '../api/enquiries';
import {
  ONBOARDING_LABEL, ONBOARDING_STYLE, PAYMENT_LABEL, customersApi, useCustomers,
  type Customer, type OnboardingStatus, type PaymentStatus,
} from '../api/work';

const PAYMENT_STYLE: Record<PaymentStatus, { bg: string; fg: string }> = {
  PENDING: { bg: '#f1e8d3', fg: '#806019' },
  DEPOSIT: { bg: '#f1e8d3', fg: '#806019' },
  PAID_IN_FULL: { bg: '#e4efe8', fg: '#2e6a4d' },
};

const ONBOARDING_OPTIONS: OnboardingStatus[] = ['NOT_STARTED', 'WELCOME_PACK_PENDING', 'TRAVEL_PENDING', 'SCREENING_COMPLETED', 'READY'];

const th = { textAlign: 'left' as const, padding: '11px 12px', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--sw-stone-600)' };

export function Customers({ app }: { app: AppStore }) {
  const { data, loading, error, reload } = useCustomers();

  async function setOnboarding(c: Customer, status: OnboardingStatus) {
    try { await customersApi.setOnboarding(c.id, status); app.showToastMsg('Onboarding status updated.'); void reload(); }
    catch (e) { app.showToastMsg(e instanceof Error ? e.message : 'Could not update.'); }
  }

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Confirmed customers</h1>
      <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Bookings handed to onboarding. Operations completes the checklist before arrival.</p>

      {error && <div style={{ marginTop: 20 }}><Callout variant="warning" title="Couldn't load customers"><div style={{ fontSize: 12.5 }}>{error} <button onClick={() => void reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div></Callout></div>}

      <div style={{ marginTop: 24, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sw-line-soft)', background: 'var(--sw-sand-050)' }}>
              <th style={{ ...th, paddingLeft: 16 }}>Customer</th>
              <th style={th}>Program · cohort</th>
              <th style={th}>Payment</th>
              <th style={th}>Onboarding</th>
              <th style={{ ...th, textAlign: 'right', paddingRight: 16 }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c, i) => {
              const ps = c.booking ? PAYMENT_STYLE[c.booking.paymentStatus] : null;
              const os = ONBOARDING_STYLE[c.onboardingStatus];
              const program = c.booking?.cohort?.program?.name ?? c.booking?.lead?.programInterest ?? '—';
              const cohort = c.booking?.cohort?.startDate ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(c.booking.cohort.startDate)) : null;
              return (
                <tr key={c.id} style={{ borderBottom: i < (data?.length ?? 0) - 1 ? '1px solid var(--sw-mist-100)' : 'none' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{c.contact.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 1 }}>{c.contact.country ?? '—'}{c.contact.timezone ? ` · ${c.contact.timezone.split('/')[1]?.replace('_', ' ')}` : ''}</div>
                  </td>
                  <td style={{ padding: '13px 12px', fontSize: 12.5, color: 'var(--sw-ink-900)' }}>{program}{cohort ? ` · ${cohort}` : ''}</td>
                  <td style={{ padding: '13px 12px' }}>{ps && c.booking && <Pill bg={ps.bg} fg={ps.fg} fontSize={11.5} padding="3px 10px">{PAYMENT_LABEL[c.booking.paymentStatus]}</Pill>}</td>
                  <td style={{ padding: '13px 12px' }}>
                    <select value={c.onboardingStatus} onChange={(e) => setOnboarding(c, e.target.value as OnboardingStatus)}
                      style={{ height: 30, borderRadius: 999, border: 'none', background: os.bg, color: os.fg, fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, padding: '0 10px', cursor: 'pointer' }}>
                      {ONBOARDING_OPTIONS.map((o) => <option key={o} value={o}>{ONBOARDING_LABEL[o]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: 'var(--sw-forest-900)', textAlign: 'right' }}>{c.booking ? formatMoney(c.booking.valueAmount, c.booking.valueCurrency) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !error && (data?.length ?? 0) === 0 && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' }}>No confirmed customers yet</div>
            <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 5 }}>Mark a lead's booking confirmed to hand it to onboarding.</div>
          </div>
        )}
        {loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading customers…</div>}
      </div>
    </div>
  );
}
