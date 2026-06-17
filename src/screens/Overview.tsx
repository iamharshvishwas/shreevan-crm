import type { AppStore } from '../store';
import { WarningIcon } from '../components/icons';
import { Avatar, BarRow, LinkButton, Pill, SectionCard, SectionTitle } from '../components/ui';
import { currentUserFromToken } from '../api/client';
import { useUsers } from '../api/users';
import { formatMinor, useOverview } from '../api/overview';
import { useAnalytics } from '../api/reports';
import { CHANNEL_LABEL, dayLabel, relTime, useEnquiryList } from '../api/enquiries';
import { stageStyle, useLeadsList, usePipelineBoard } from '../api/leads';
import { tasksApi, useCalls, useTasks } from '../api/work';

const metricCardStyle = { background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px' } as const;
const metricLabelStyle = { fontSize: 11.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' } as const;
const metricValueStyle = { fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 30, color: 'var(--sw-ink-900)', marginTop: 8 } as const;
const PCOLORS = ['#173d32', '#315a49', '#55745c', '#3d6b56', '#a95f45', '#397684', '#b58b3a', '#806019', '#2e6a4d', '#9e3f3f'];

export function Overview({ app }: { app: AppStore }) {
  const ov = useOverview();
  const m = ov.data?.metrics;
  const show = (n: number | undefined) => (ov.loading ? '…' : n === undefined ? '—' : String(n));

  const analytics = useAnalytics();
  const users = useUsers();
  const tasks = useTasks('all');
  const calls = useCalls();
  const board = usePipelineBoard();
  const attention = useLeadsList('no_next_action', 'all', '');
  const recentEnq = useEnquiryList({ view: 'all' });

  const priorityTasks = (tasks.data ?? []).filter((t) => t.bucket === 'today' || t.bucket === 'overdue').slice(0, 5);
  const ownerName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? 'Owner' : '');

  const me = currentUserFromToken();
  const firstName = (users.find((u) => u.id === me?.id)?.name ?? '').split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const maxStage = Math.max(1, ...(board.data ?? []).map((c) => c.count));

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 28, lineHeight: 1.2, color: 'var(--sw-ink-900)' }}>{greeting}, {firstName}</h1>
          <p style={{ margin: '6px 0 0 0', fontSize: 14, color: 'var(--sw-stone-600)' }}>Here's where your leads stand today — live from the CRM.</p>
        </div>
      </div>

      {ov.error && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sw-warning-bg)', border: '1px solid #e3d3a8', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-warning)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--sw-warning)', fontWeight: 600 }}>Live metrics unavailable — {ov.error}</span>
          <button onClick={() => void ov.reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button>
        </div>
      )}

      {/* Metric cards */}
      <div className="sw-metric-grid" style={{ marginTop: 24 }}>
        <Metric label="New enquiries" value={show(m?.newEnquiries)} note={m ? `${m.unassigned} unassigned` : 'last 30 days'} />
        <Metric label="Needs reply" value={show(m?.needsReply)} note={m ? `${m.slaBreached} SLA breached` : '—'} noteTone={m && m.slaBreached > 0 ? 'var(--sw-error)' : undefined} />
        <Metric label="Discovery calls scheduled" value={show(m?.discoveryCallsScheduled)} note="upcoming" />
        <Metric label="Qualified opportunities" value={show(m?.qualifiedOpportunities)} note="in the pipeline" />
        <Metric label="Confirmed bookings" value={show(m?.confirmedBookings)} note="to date" />
        <div style={{ ...metricCardStyle, background: 'var(--sw-forest-900)', border: '1px solid var(--sw-forest-900)' }}>
          <div style={{ ...metricLabelStyle, color: 'rgba(255,255,255,0.65)' }}>Expected booking revenue</div>
          <div style={{ ...metricValueStyle, fontSize: 23, lineHeight: 1.2, color: '#ffffff' }}>
            {!m ? '…' : formatMinor(m.expectedRevenue.USD, 'USD')} {m && <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>+ {formatMinor(m.expectedRevenue.INR, 'INR')}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{m ? `${m.qualifiedOpportunities} active in pipeline` : 'open pipeline'}</div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Today's priority actions */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <SectionTitle>Today's priority actions</SectionTitle>
              <LinkButton onClick={() => app.goNav('tasks')}>View all tasks</LinkButton>
            </div>
            {priorityTasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', padding: '8px 0' }}>{tasks.loading ? 'Loading…' : 'Nothing due today.'}</div>}
            {priorityTasks.map((t) => (
              <div key={t.id} className="hov-mist" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderRadius: 10, margin: '1px -10px' }}>
                <button onClick={() => tasksApi.setDone(t.id, t.status !== 'DONE').then(() => tasks.reload())} title="Mark done" style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${t.status === 'DONE' ? '#2e6a4d' : '#a8b3ad'}`, background: t.status === 'DONE' ? '#2e6a4d' : 'transparent', cursor: 'pointer', flexShrink: 0, color: '#fff', padding: 0 }}>{t.status === 'DONE' ? '✓' : ''}</button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 2 }}>{t.relatedName ?? '—'} · {t.type}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: t.bucket === 'overdue' ? '#f2e0e0' : '#e8f0ec', color: t.bucket === 'overdue' ? '#9e3f3f' : '#315a49', whiteSpace: 'nowrap' }}>{t.bucket === 'overdue' ? 'Overdue' : 'Today'}</span>
                {t.ownerId && <Avatar name={ownerName(t.ownerId)} />}
              </div>
            ))}
          </SectionCard>

          {/* Leads requiring attention */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: 'var(--sw-warning)', display: 'flex' }}><WarningIcon /></span>
              <SectionTitle>Leads requiring attention</SectionTitle>
            </div>
            {(attention.data?.data.length ?? 0) === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{attention.loading ? 'Loading…' : 'Every active lead has a next action. 🎉'}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(attention.data?.data ?? []).slice(0, 4).map((l) => {
                const ss = stageStyle(l.stage.key);
                return (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--sw-line-soft)', background: 'var(--sw-warning-bg)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)' }}>{l.contact.name}</span>
                        <Pill bg={ss.bg} fg={ss.fg}>{l.stage.label}</Pill>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--sw-warning)', fontWeight: 600, marginTop: 3 }}>No next action assigned</div>
                    </div>
                    <button onClick={() => app.openLead(l.id)} className="hov-mist" style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: '#ffffff', color: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Open lead</button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Recent enquiries */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionTitle>Recent enquiries</SectionTitle>
              <LinkButton onClick={() => app.goNav('enquiries')}>View all</LinkButton>
            </div>
            {(recentEnq.data?.data.length ?? 0) === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{recentEnq.loading ? 'Loading…' : 'No enquiries yet.'}</div>}
            {(recentEnq.data?.data ?? []).slice(0, 4).map((e) => (
              <button key={e.id} onClick={() => app.goNav('enquiries')} className="hov-mist" style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1.2fr) minmax(0,1.6fr) auto', alignItems: 'center', gap: 12, padding: '11px 10px', margin: '0 -10px', border: 'none', background: 'transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{e.contact.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 1 }}>{e.contact.country ?? '—'}</div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.programInterest ?? CHANNEL_LABEL[e.channel]}</div>
                <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', whiteSpace: 'nowrap' }}>{dayLabel(e.lastMessageAt)}</div>
              </button>
            ))}
          </SectionCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Upcoming discovery calls */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <SectionTitle>Upcoming discovery calls</SectionTitle>
              <LinkButton onClick={() => app.goNav('calls')}>All calls</LinkButton>
            </div>
            {(calls.data?.upcoming.length ?? 0) === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{calls.loading ? 'Loading…' : 'No upcoming calls.'}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(calls.data?.upcoming ?? []).slice(0, 4).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, flexShrink: 0, textAlign: 'center', background: 'var(--sw-mist-100)', borderRadius: 10, padding: '6px 0' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-forest-900)', lineHeight: 1.1 }}>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(c.scheduledAt))}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(c.scheduledAt))}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{c.contact.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 1 }}>{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(c.scheduledAt))} IST · {c.contact.country ?? ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Pipeline summary */}
          <SectionCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionTitle>Booking pipeline</SectionTitle>
              <LinkButton onClick={() => app.goNav('pipeline')}>Open board</LinkButton>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(board.data ?? []).slice(0, 9).map((c, i) => (
                <BarRow key={c.id} label={c.label} color={PCOLORS[i]} width={`${Math.round((c.count / maxStage) * 100)}%`} count={c.count} />
              ))}
            </div>
          </SectionCard>

          {/* Lead sources */}
          <SectionCard>
            <SectionTitle style={{ marginBottom: 14 }}>Lead sources</SectionTitle>
            {(analytics.data?.byChannel.length ?? 0) === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>No data yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(() => {
                const rows = analytics.data?.byChannel ?? [];
                const max = Math.max(1, ...rows.map((r) => r.count));
                return rows.map((r, i) => <BarRow key={r.label} label={CHANNEL_LABEL[r.label as never] ?? r.label} color={PCOLORS[i % PCOLORS.length]} width={`${Math.round((r.count / max) * 100)}%`} count={r.count} />);
              })()}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Bottom: funnel + activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <SectionCard>
          <SectionTitle style={{ marginBottom: 4 }}>Conversion funnel</SectionTitle>
          <p style={{ margin: '0 0 18px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>
            {analytics.data ? `${analytics.data.conversion.enquiries} enquiries → ${analytics.data.conversion.bookings} bookings (${analytics.data.conversion.leadToBookingRate}% lead→booking)` : '…'}
          </p>
          {analytics.data && (() => {
            const c = analytics.data.conversion;
            const steps = [{ label: 'Enquiries', v: c.enquiries }, { label: 'Qualified leads', v: c.leads }, { label: 'Bookings', v: c.bookings }];
            const max = Math.max(1, c.enquiries);
            const colors = ['var(--sw-forest-900)', 'var(--sw-moss-600)', 'var(--sw-clay-600)'];
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'end', height: 150 }}>
                  {steps.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{s.v}</span>
                      <div style={{ background: colors[i], borderRadius: '8px 8px 4px 4px', height: `${Math.max(6, Math.round((s.v / max) * 100))}%` }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 8 }}>
                  {steps.map((s) => <span key={s.label} style={{ fontSize: 11, color: 'var(--sw-stone-600)', textAlign: 'center' }}>{s.label}</span>)}
                </div>
              </>
            );
          })()}
        </SectionCard>

        <SectionCard>
          <SectionTitle style={{ marginBottom: 14 }}>Recent activity</SectionTitle>
          {(ov.data?.recentActivity.length ?? 0) === 0 && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>No recent activity.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(ov.data?.recentActivity ?? []).map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-forest-700)', marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--sw-ink-900)' }}>{a.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase())} · {a.entityType}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 2 }}>{relTime(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Metric({ label, value, note, noteTone }: { label: string; value: string; note: string; noteTone?: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
      <div style={{ fontSize: 12.5, color: noteTone ?? 'var(--sw-stone-600)', marginTop: 4, fontWeight: noteTone ? 600 : 400 }}>{note}</div>
    </div>
  );
}
