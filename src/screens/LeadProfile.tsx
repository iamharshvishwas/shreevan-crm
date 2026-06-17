import { useEffect, useState } from 'react';
import type { AppStore } from '../store';
import { ApiError } from '../api/client';
import { BackIcon, CalendarIcon, WarningIcon } from '../components/icons';
import { FieldLabel, OutlineButton, Pill, SectionCard, SectionTitle, SolidButton } from '../components/ui';
import { CHANNEL_LABEL, formatMoney, relTime } from '../api/enquiries';
import { TEMP_STYLE, leadsApi, stageStyle, useLead, useStages } from '../api/leads';

const HEALTH_LABEL: Record<string, string> = { REQUIRED: 'Health screening required', COMPLETED: 'Health screening completed' };
const ELIG_LABEL: Record<string, string> = { PENDING: 'Eligibility review pending', IN_REVIEW: 'Eligibility review in progress', APPROVED: 'Eligibility review approved' };

const infoCard = { background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px' } as const;
const infoTitle = { margin: '0 0 12px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15.5, color: 'var(--sw-ink-900)' } as const;

export function LeadProfile({ app }: { app: AppStore }) {
  const { data: lead, loading, error, reload } = useLead(app.selectedLeadId);
  const stages = useStages();
  const [lostReasons, setLostReasons] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => { leadsApi.lostReasons().then(setLostReasons).catch(() => setLostReasons([])); }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); app.showToastMsg(ok); void reload(); }
    catch (e) { app.showToastMsg(e instanceof ApiError ? e.message : 'Action failed.'); }
  }

  const back = (
    <button onClick={() => app.setSelectedLeadId(null)} className="hov-mist-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--sw-river-600)', padding: '6px 10px 6px 6px', borderRadius: 8 }}>
      <BackIcon /> Back to leads
    </button>
  );

  if (loading) return <div style={{ padding: '24px 32px' }}>{back}<div style={{ marginTop: 20, fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading lead…</div></div>;
  if (error || !lead) {
    return (
      <div style={{ padding: '24px 32px' }}>{back}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>Lead not found</div>
          <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 5 }}>{error ?? 'This lead may not exist on the server yet.'}</div>
        </div>
      </div>
    );
  }

  const ss = stageStyle(lead.stage.key);
  const ts = TEMP_STYLE[lead.temperature];
  const isOpen = !lead.confirmedAt && !lead.closedLostAt;
  const noNext = isOpen && !lead.nextAction;

  function editNextAction() {
    const action = window.prompt('Next action:', lead!.nextAction ?? '');
    if (!action?.trim()) return;
    const date = window.prompt('Next-action date (YYYY-MM-DD):', new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    if (!date) return;
    void run(() => leadsApi.setNextAction(lead!.id, action.trim(), new Date(`${date}T09:00:00`).toISOString()), 'Next action updated.');
  }

  return (
    <div style={{ padding: '24px 32px 48px 32px', maxWidth: 1440, margin: '0 auto' }}>
      {back}

      {/* Header */}
      <div style={{ marginTop: 14, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 25, color: 'var(--sw-ink-900)' }}>{lead.contact.name}</h1>
              <Pill bg={ss.bg} fg={ss.fg} fontSize={12} padding="4px 12px">{lead.stage.label}</Pill>
              <Pill bg={ts.bg} fg={ts.fg} fontSize={11.5} fontWeight={700} padding="3px 10px" dotSize={5} gap={5}>{ts.label}</Pill>
            </div>
            <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 6 }}>
              {lead.contact.country ?? '—'}{lead.contact.timezone ? ` · ${lead.contact.timezone.split('/')[1]?.replace('_', ' ')}` : ''} · {CHANNEL_LABEL[lead.firstTouchSource]} · Owner: {lead.owner?.name ?? 'Unassigned'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <select value={lead.stage.key} onChange={(e) => run(() => leadsApi.moveStage(lead.id, e.target.value), 'Stage updated.')} title="Move stage"
              style={{ height: 36, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)', padding: '0 8px', cursor: 'pointer' }}>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <OutlineButton onClick={editNextAction}>Set next action</OutlineButton>
            {isOpen && <SolidButton onClick={() => run(() => leadsApi.confirmBooking(lead.id), 'Booking confirmed — handed to onboarding.')}>Mark booking confirmed</SolidButton>}
            {isOpen && (
              <select value="" onChange={(e) => { if (e.target.value) run(() => leadsApi.closeLost(lead.id, e.target.value), 'Lead marked closed lost.'); }} title="Close lost"
                style={{ height: 36, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-error)', padding: '0 8px', cursor: 'pointer' }}>
                <option value="">Close lost…</option>
                {lostReasons.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Next-action banner */}
        {lead.nextAction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, background: 'var(--sw-mist-100)', border: '1px solid var(--sw-line-mist)', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ display: 'flex', color: 'var(--sw-forest-700)' }}><CalendarIcon /></span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)' }}>Next action: {lead.nextAction}</span>
              <span style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginLeft: 10 }}>{lead.nextActionDate ? relTime(lead.nextActionDate) : ''}</span>
            </div>
          </div>
        )}
        {noNext && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, background: 'var(--sw-warning-bg)', border: '1px solid #e3d3a8', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ display: 'flex', color: 'var(--sw-warning)' }}><WarningIcon /></span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--sw-warning)' }}>No next action assigned — this lead can slip through the cracks.</span>
            <SolidButton onClick={editNextAction} height={32} style={{ fontSize: 12, padding: '0 14px' }}>Add next action</SolidButton>
          </div>
        )}
        {lead.closedLostAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, background: 'var(--sw-error-bg)', border: '1px solid #e7c9c9', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ display: 'flex', color: 'var(--sw-error)' }}><WarningIcon /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-error)' }}>Closed lost</span>
            <span style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{lead.lostReason ? `Reason: ${lead.lostReason.label}` : ''}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={infoCard}>
            <h2 style={infoTitle}>Contact</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lead.contact.identities.map((id) => (
                <div key={id.id}><FieldLabel>{CHANNEL_LABEL[id.channel]}</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2, wordBreak: 'break-all' }}>{id.handle}</div></div>
              ))}
              <div><FieldLabel>Preferred contact</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.contact.preferredContact ?? '—'}</div></div>
              <div><FieldLabel>Language</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.contact.language ?? '—'}</div></div>
            </div>
          </section>

          <section style={infoCard}>
            <h2 style={infoTitle}>Program details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}><FieldLabel>Interested program</FieldLabel><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.programInterest ?? '—'}</div></div>
              <div><FieldLabel>Participants</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.participants}</div></div>
              <div><FieldLabel>Expected value</FieldLabel><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sw-forest-900)', marginTop: 2 }}>{formatMoney(lead.expectedValueAmount, lead.expectedValueCurrency)}</div></div>
              <div><FieldLabel>Preferred dates</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.preferredDates ?? '—'}</div></div>
              <div><FieldLabel>Decision</FieldLabel><div style={{ fontSize: 13, color: 'var(--sw-ink-900)', marginTop: 2 }}>{lead.decisionDate ? relTime(lead.decisionDate) : '—'}</div></div>
            </div>
          </section>

          <section style={infoCard}>
            <h2 style={infoTitle}>Administrative status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              {lead.healthScreening && <Pill bg={lead.healthScreening === 'COMPLETED' ? '#e4efe8' : '#f1e8d3'} fg={lead.healthScreening === 'COMPLETED' ? '#2e6a4d' : '#806019'} fontSize={12.5} padding="5px 12px" gap={7}>{HEALTH_LABEL[lead.healthScreening]}</Pill>}
              {lead.eligibility && <Pill bg="var(--sw-mist-100)" fg="var(--sw-forest-700)" fontSize={12.5} padding="5px 12px" gap={7}>{ELIG_LABEL[lead.eligibility]}</Pill>}
            </div>
            <p style={{ margin: '12px 0 0 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--sw-stone-600)' }}>Only administrative screening statuses are stored — never medical detail.</p>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lead.booking && (
            <SectionCard>
              <SectionTitle style={{ marginBottom: 8 }}>Booking</SectionTitle>
              <div style={{ fontSize: 13, color: 'var(--sw-ink-900)' }}>Payment: {lead.booking.paymentStatus.replace(/_/g, ' ').toLowerCase()} · Onboarding: {lead.booking.customer?.onboardingStatus.replace(/_/g, ' ').toLowerCase() ?? '—'}</div>
            </SectionCard>
          )}
          <SectionCard>
            <SectionTitle style={{ marginBottom: 12 }}>Activity</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {lead.activities.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-forest-700)', marginTop: 5, flexShrink: 0 }} />
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{a.title}</div>{a.body && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 2 }}>{a.body}</div>}<div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 3 }}>{relTime(a.at)}</div></div>
                </div>
              ))}
              {lead.activities.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>No activity yet.</div>}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionTitle style={{ marginBottom: 12 }}>Stage history</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lead.stageHistory.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--sw-ink-900)' }}>
                  <span style={{ color: 'var(--sw-stone-600)' }}>{h.fromStage ? `${h.fromStage.label} →` : ''}</span>
                  <strong>{h.toStage.label}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--sw-stone-600)' }}>{relTime(h.at)}</span>
                </div>
              ))}
              {lead.stageHistory.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>No stage changes yet.</div>}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
