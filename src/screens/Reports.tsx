import type { AppStore } from '../store';
import { BarRow, Callout, SectionCard, SectionTitle } from '../components/ui';
import { CHANNEL_LABEL, formatMoney, type Channel } from '../api/enquiries';
import { formatMins, useAnalytics, type Tally } from '../api/reports';

const PALETTE = ['var(--sw-forest-900)', 'var(--sw-moss-600)', 'var(--sw-river-600)', 'var(--sw-gold-500)', 'var(--sw-clay-600)', 'var(--sw-forest-700)', 'var(--sw-stone-600)', 'var(--sw-forest-600)'];

function Bars({ rows, channel = false, labelWidth = 170 }: { rows: Tally[]; channel?: boolean; labelWidth?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>No data yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map((r, i) => (
        <BarRow key={r.label} label={channel ? (CHANNEL_LABEL[r.label as Channel] ?? r.label) : r.label} color={PALETTE[i % PALETTE.length]} width={`${Math.round((r.count / max) * 100)}%`} count={r.count} labelWidth={labelWidth} />
      ))}
    </div>
  );
}

export function Reports({ app }: { app: AppStore }) {
  void app;
  const { data, loading, error, reload } = useAnalytics();

  const kpis = data ? [
    { label: 'Enquiry → lead', value: `${data.conversion.enquiryToLeadRate}%`, note: `${data.conversion.leads} from ${data.conversion.enquiries} enquiries` },
    { label: 'Lead → booking', value: `${data.conversion.leadToBookingRate}%`, note: `${data.conversion.bookings} bookings` },
    { label: 'Avg first response', value: formatMins(data.conversion.avgFirstResponseMins), note: 'across answered enquiries' },
    { label: 'Total enquiries', value: String(data.conversion.enquiries), note: 'all channels' },
  ] : [];

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Reports</h1>
          <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Conversion and source quality · computed live on the server.</p>
        </div>
      </div>

      {error && <div style={{ marginTop: 20 }}><Callout variant="warning" title="Couldn't load reports"><div style={{ fontSize: 12.5 }}>{error} <button onClick={reload} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div></Callout></div>}
      {loading && <div style={{ marginTop: 20, fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading analytics…</div>}

      {data && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 24 }}>
            {kpis.map((k) => (
              <div key={k.label} style={{ background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>{k.label}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 28, color: 'var(--sw-ink-900)', marginTop: 8 }}>{k.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 4 }}>{k.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
            <SectionCard>
              <SectionTitle style={{ marginBottom: 14 }}>Conversations by channel</SectionTitle>
              <Bars rows={data.byChannel} channel />
            </SectionCard>

            <SectionCard>
              <SectionTitle style={{ marginBottom: 14 }}>Leads by country</SectionTitle>
              <Bars rows={data.byCountry} />
            </SectionCard>

            <SectionCard>
              <SectionTitle style={{ marginBottom: 14 }}>Leads by interested program</SectionTitle>
              <Bars rows={data.byProgram} labelWidth={190} />
              <SectionTitle style={{ margin: '24px 0 14px 0' }}>Lost-booking reasons</SectionTitle>
              <Bars rows={data.lostReasons} labelWidth={190} />
            </SectionCard>

            <SectionCard>
              <SectionTitle style={{ marginBottom: 4 }}>Expected vs confirmed revenue</SectionTitle>
              <p style={{ margin: '0 0 16px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Kept per-currency — never combined.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <RevenueCell label="Expected · USD" value={formatMoney(data.revenue.expected.USD, 'USD')} tone="var(--sw-mist-100)" />
                <RevenueCell label="Confirmed · USD" value={formatMoney(data.revenue.confirmed.USD, 'USD')} tone="var(--sw-success-bg)" />
                <RevenueCell label="Expected · INR" value={formatMoney(data.revenue.expected.INR, 'INR')} tone="var(--sw-mist-100)" />
                <RevenueCell label="Confirmed · INR" value={formatMoney(data.revenue.confirmed.INR, 'INR')} tone="var(--sw-success-bg)" />
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

function RevenueCell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ background: tone, border: '1px solid var(--sw-line-mist)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: 'var(--sw-ink-900)', marginTop: 4 }}>{value}</div>
    </div>
  );
}
