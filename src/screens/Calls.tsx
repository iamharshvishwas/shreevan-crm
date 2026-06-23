import type { AppStore } from '../store';
import { ClockIcon } from '../components/icons';
import { Callout, DateTile, Pill } from '../components/ui';
import { istFirst } from '../api/enquiries';
import { callsApi, useCalls, type DiscoveryCall } from '../api/work';

const istPart = (utc: string, opt: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...opt, timeZone: 'Asia/Kolkata' }).format(new Date(utc));

export function Calls({ app }: { app: AppStore }) {
  const { data, loading, error, reload } = useCalls();

  async function complete(c: DiscoveryCall) {
    const outcome = window.prompt('Call outcome (optional):', '') ?? undefined;
    try { await callsApi.complete(c.id, outcome); app.showToastMsg('Call marked completed.'); void reload(); }
    catch (e) { app.showToastMsg(e instanceof Error ? e.message : 'Could not update call.'); }
  }
  async function reschedule(c: DiscoveryCall) {
    const d = window.prompt('New date/time (YYYY-MM-DD HH:mm, IST):', '');
    if (!d) return;
    const iso = new Date(d.replace(' ', 'T') + ':00+05:30').toISOString();
    try { await callsApi.reschedule(c.id, iso); app.showToastMsg('Call rescheduled.'); void reload(); }
    catch (e) { app.showToastMsg(e instanceof Error ? e.message : 'Could not reschedule.'); }
  }

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Discovery calls</h1>
      <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Times are shown in IST first, then the lead's local time.</p>

      {error && <div style={{ marginTop: 20 }}><Callout variant="warning" title="Couldn't load calls"><div style={{ fontSize: 12.5 }}>{error} <button onClick={() => void reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div></Callout></div>}
      {loading && <div style={{ marginTop: 20, fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading calls…</div>}

      {data && (
        <>
          <h2 style={{ margin: '26px 0 12px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>Upcoming</h2>
          {data.upcoming.length === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>No upcoming discovery calls.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
            {data.upcoming.map((c) => (
              <div key={c.id} style={{ background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px', display: 'flex', gap: 16 }}>
                <DateTile day={istPart(c.scheduledAt, { day: 'numeric' })} month={istPart(c.scheduledAt, { month: 'short' })} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    {c.lead ? (
                      <button onClick={() => app.openLead(c.lead!.id)} className="hov-underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--sw-forest-900)' }}>{c.contact?.name ?? 'Unknown caller'}</button>
                    ) : <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--sw-forest-900)' }}>{c.contact?.name ?? 'Unknown caller'}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 3 }}>{c.contact?.country ?? '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>
                    <ClockIcon /> {istFirst(c.scheduledAt, c.contact?.timezone)}
                  </div>
                  {c.prepNotes && <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 7, lineHeight: 1.5 }}>Prep: {c.prepNotes}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => complete(c)} className="hov-forest-deep" style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Mark completed</button>
                    <button onClick={() => reschedule(c)} className="hov-underline" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--sw-river-600)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reschedule</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ margin: '30px 0 12px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>Recently completed</h2>
          {data.completed.length === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>No completed calls yet.</div>}
          {data.completed.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              {data.completed.map((c, i) => {
                const isVeda = !!c.externalCallId;
                return (
                  <div key={c.id} style={{ padding: '13px 18px', borderBottom: i < data.completed.length - 1 ? '1px solid var(--sw-mist-100)' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) minmax(0,1.4fr) auto', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)', display: 'flex', alignItems: 'center', gap: 7 }}>
                        {c.contact?.name ?? 'Unknown caller'}
                        {isVeda && <Pill bg="#e4efe8" fg="var(--sw-forest-900)" fontSize={10.5} padding="2px 8px">Veda AI call</Pill>}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--sw-ink-900)' }}>{c.summary ?? (c.outcome ? `Outcome: ${c.outcome}` : '—')}</span>
                      <Pill bg="#e4efe8" fg="#2e6a4d" fontSize={11.5} padding="3px 10px">Completed</Pill>
                    </div>
                    {(c.recordingUrl || c.transcriptRedacted) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                        {c.recordingUrl && (
                          <a href={c.recordingUrl} target="_blank" rel="noreferrer" className="hov-underline" style={{ color: 'var(--sw-river-600)', fontWeight: 600, textDecoration: 'none' }}>
                            ▶ Recording
                          </a>
                        )}
                        {c.transcriptRedacted && (
                          <details style={{ color: 'var(--sw-stone-600)' }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 600 }}>Transcript (health-redacted)</summary>
                            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 240, overflowY: 'auto', background: 'var(--sw-sand-050)', padding: 10, borderRadius: 8 }}>{c.transcriptRedacted}</div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
