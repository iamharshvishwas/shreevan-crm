import { useEffect, useState, useCallback } from 'react';
import type { AppStore } from '../store';
import { vedaApi, type VedaConfig, type VedaApproval, type VedaActionLog, type VedaSummary, type VedaAnalytics, type KnowledgeEntry } from '../api/veda';
import { useAuth } from '../auth/useAuth';

const STEP_LABELS: Record<string, { label: string; desc: string; phase: string }> = {
  QUALIFY_LEAD:  { label: 'Lead Qualification',  desc: 'Extract program, budget, language & urgency from every new lead', phase: 'Phase 1' },
  SEND_EMAIL:    { label: 'Auto Email',           desc: 'Draft personalised follow-up emails for approval before sending',   phase: 'Phase 1' },
  SEND_WHATSAPP: { label: 'WhatsApp Messages',    desc: 'Send WhatsApp greetings & slot-scheduling via Meta Cloud API',      phase: 'Phase 2' },
  VOICE_CALL:    { label: 'AI Voice Calls',       desc: 'Outbound discovery calls via Vapi/Retell with Hindi+English',      phase: 'Phase 3' },
  CHAT_REPLY:    { label: 'Live Chat Replies',    desc: 'Veda chats in real time on the website widget & WhatsApp (auto-replies instantly)', phase: 'Live chat' },
  NURTURE:       { label: 'Nurture Sequences',    desc: 'Multi-touch follow-up (email + WhatsApp) for cold leads until they reply or convert', phase: 'Nurture' },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   '#d97706',
  APPROVED:  '#059669',
  REJECTED:  '#dc2626',
  EXPIRED:   '#6b7280',
  AUTO_SENT: '#2563eb',
  COMPLETED: '#059669',
  FAILED:    '#dc2626',
  SKIPPED:   '#6b7280',
  KILLED:    '#dc2626',
  QUEUED:    '#2563eb',
  RUNNING:   '#7c3aed',
};

function Badge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
      background: (STATUS_COLORS[status] ?? '#6b7280') + '18',
      color: STATUS_COLORS[status] ?? '#6b7280',
    }}>
      {status}
    </span>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--sw-forest-700)' : '#d1d5db',
        position: 'relative', transition: 'background 200ms', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--sw-sand-200)',
      padding: 24, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sw-ink-400)', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Veda({ app }: { app: AppStore }) {
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'ADMIN';

  const [config, setConfig]         = useState<VedaConfig | null>(null);
  const [approvals, setApprovals]   = useState<VedaApproval[]>([]);
  const [logs, setLogs]             = useState<VedaActionLog[]>([]);
  const [summary, setSummary]       = useState<VedaSummary | null>(null);
  const [analytics, setAnalytics]   = useState<VedaAnalytics | null>(null);
  const [knowledge, setKnowledge]   = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [activeTab, setActiveTab]   = useState<'pending' | 'history' | 'analytics' | 'knowledge'>('pending');

  const load = useCallback(async () => {
    try {
      const [cfg, appr, lg, sum, an, kb] = await Promise.all([
        isAdmin ? vedaApi.getConfig() : Promise.resolve(null),
        vedaApi.listApprovals('PENDING'),
        vedaApi.getLogs(20),
        vedaApi.getSummary(),
        vedaApi.getAnalytics().catch(() => null),
        vedaApi.listKnowledge().catch(() => []),
      ]);
      if (cfg) setConfig(cfg);
      setApprovals(appr.items);
      setLogs(lg.items);
      setSummary(sum);
      setAnalytics(an);
      setKnowledge(kb);
    } catch {
      // non-fatal — show whatever loaded
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  async function toggleGlobal(on: boolean) {
    if (!config || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await vedaApi.updateConfig({ globalEnabled: on });
      setConfig(updated);
      app.showToastMsg(on ? 'Veda enabled' : 'Veda paused — kill switch engaged');
    } catch {
      app.showToastMsg('Failed to update config');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStep(key: string, field: 'enabled' | 'autoApprove', value: boolean) {
    if (!config || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await vedaApi.updateConfig({ [key]: { [field]: value } });
      setConfig(updated);
    } catch {
      app.showToastMsg('Failed to update config');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await vedaApi.approve(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      app.showToastMsg('Action approved — Veda will execute shortly');
    } catch {
      app.showToastMsg('Failed to approve');
    }
  }

  async function handleReject(id: string) {
    try {
      await vedaApi.reject(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      app.showToastMsg('Action rejected');
    } catch {
      app.showToastMsg('Failed to reject');
    }
  }

  async function addKnowledge(title: string, content: string, category: string) {
    try {
      const entry = await vedaApi.createKnowledge({ title, content, category: category || undefined });
      setKnowledge((prev) => [entry, ...prev]);
      app.showToastMsg('Added to Veda’s knowledge');
    } catch {
      app.showToastMsg('Failed to add knowledge');
    }
  }

  async function toggleKnowledge(entry: KnowledgeEntry) {
    try {
      const updated = await vedaApi.updateKnowledge(entry.id, { active: !entry.active });
      setKnowledge((prev) => prev.map((k) => (k.id === entry.id ? updated : k)));
    } catch {
      app.showToastMsg('Failed to update');
    }
  }

  async function removeKnowledge(id: string) {
    try {
      await vedaApi.deleteKnowledge(id);
      setKnowledge((prev) => prev.filter((k) => k.id !== id));
      app.showToastMsg('Removed');
    } catch {
      app.showToastMsg('Failed to remove');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--sw-ink-400)', fontSize: 14 }}>
        Loading Veda console…
      </div>
    );
  }

  const globalOn = config?.globalEnabled ?? false;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--sw-forest-900)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/>
              <path d="M12 6v6l4 2"/>
              <path d="M20 2v4h4"/>
              <path d="M22 2 17 7"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: 'var(--sw-ink-900)' }}>
              Veda
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--sw-ink-400)' }}>
              Your AI agent — omnichannel client automation for Shreevan Wellness
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              background: globalOn ? '#dcfce7' : '#f3f4f6',
              color: globalOn ? '#15803d' : '#6b7280',
              border: `1px solid ${globalOn ? '#86efac' : '#e5e7eb'}`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: globalOn ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
              {globalOn ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total actions', value: summary.total },
            { label: 'Completed', value: summary.completed },
            { label: 'Failed', value: summary.failed },
            { label: "Today's cost", value: `$${summary.todayCostUsd}` },
          ].map((s) => (
            <Card key={s.label} style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--sw-ink-900)', fontFamily: 'var(--font-heading)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--sw-ink-400)', marginTop: 2 }}>{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Kill switch — ADMIN only */}
      {isAdmin && config && (
        <Card style={{ marginBottom: 24, borderColor: globalOn ? '#86efac' : 'var(--sw-sand-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sw-ink-900)', marginBottom: 3 }}>
                Global Kill Switch
              </div>
              <div style={{ fontSize: 13, color: 'var(--sw-ink-400)' }}>
                {globalOn
                  ? 'Veda is running. Flip to instantly pause all AI actions.'
                  : 'Veda is paused. No AI actions will fire until you enable it.'}
              </div>
            </div>
            <Toggle on={globalOn} onChange={toggleGlobal} disabled={saving} />
          </div>
        </Card>
      )}

      {/* Step config — ADMIN only */}
      {isAdmin && config && (
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle>Automation steps</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Object.entries(STEP_LABELS).map(([key, meta], i, arr) => {
              const step = config.steps[key as keyof typeof config.steps];
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    gap: 16, alignItems: 'center',
                    padding: '16px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--sw-sand-100)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: step.enabled ? 'var(--sw-ink-900)' : 'var(--sw-ink-400)' }}>
                        {meta.label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                        padding: '1px 7px', borderRadius: 999,
                        background: 'var(--sw-sand-100)', color: 'var(--sw-ink-400)',
                      }}>
                        {meta.phase}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sw-ink-400)' }}>{meta.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--sw-ink-400)', marginBottom: 4 }}>Enabled</div>
                    <Toggle
                      on={step.enabled}
                      onChange={(v) => toggleStep(key, 'enabled', v)}
                      disabled={saving}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--sw-ink-400)', marginBottom: 4 }}>Auto-approve</div>
                    <Toggle
                      on={step.autoApprove}
                      onChange={(v) => toggleStep(key, 'autoApprove', v)}
                      disabled={saving || !step.enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Approvals + timeline tabs */}
      <Card>
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--sw-sand-100)' }}>
          {(['pending', 'history', 'analytics', 'knowledge'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 18px 12px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'var(--font-body)',
                fontSize: 13.5, fontWeight: 600,
                color: activeTab === tab ? 'var(--sw-forest-800)' : 'var(--sw-ink-400)',
                borderBottom: activeTab === tab ? '2px solid var(--sw-forest-700)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab === 'pending'
                ? `Pending approvals${approvals.length > 0 ? ` (${approvals.length})` : ''}`
                : tab === 'history' ? 'Action history'
                : tab === 'analytics' ? 'ROI & analytics'
                : `Knowledge${knowledge.length ? ` (${knowledge.length})` : ''}`}
            </button>
          ))}
        </div>

        {activeTab === 'analytics' && <AnalyticsPanel a={analytics} />}
        {activeTab === 'knowledge' && (
          <KnowledgePanel
            entries={knowledge}
            isAdmin={isAdmin}
            onAdd={addKnowledge}
            onToggle={toggleKnowledge}
            onRemove={removeKnowledge}
          />
        )}

        {activeTab === 'pending' && (
          approvals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sw-ink-400)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              No pending approvals — Veda has nothing awaiting your review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {approvals.map((a) => (
                <div key={a.id} style={{
                  border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: 16,
                  borderLeft: '4px solid #d97706',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Badge status={a.type} />
                        <span style={{ fontSize: 11.5, color: 'var(--sw-ink-400)' }}>{a.entityType} · {relTime(a.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--sw-ink-800)', lineHeight: 1.5 }}>{a.draftText}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleApprove(a.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                          background: 'var(--sw-forest-700)', color: '#fff',
                          fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(a.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                          border: '1px solid #fca5a5', background: '#fef2f2',
                          color: '#dc2626', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sw-ink-400)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              No actions yet — Veda's timeline will appear here once she starts working.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {logs.map((log, i) => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 0',
                  borderBottom: i < logs.length - 1 ? '1px solid var(--sw-sand-100)' : 'none',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: STATUS_COLORS[log.status] ?? '#6b7280',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-800)' }}>{log.type}</span>
                      <Badge status={log.status} />
                      {log.durationMs && (
                        <span style={{ fontSize: 11, color: 'var(--sw-ink-400)' }}>{log.durationMs}ms</span>
                      )}
                      {log.costUsdMicro && (
                        <span style={{ fontSize: 11, color: 'var(--sw-ink-400)' }}>${(log.costUsdMicro / 1_000_000).toFixed(4)}</span>
                      )}
                    </div>
                    {log.approval && (
                      <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)', marginBottom: 2 }}>{log.approval.draftText}</div>
                    )}
                    {log.error && (
                      <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>{log.error}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--sw-ink-400)', flexShrink: 0 }}>{relTime(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </Card>
    </div>
  );
}

// --- ROI & analytics --------------------------------------------------------

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: 'var(--sw-ink-800)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--sw-ink-400)' }}>{value}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'var(--sw-sand-100)', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 400ms' }} />
      </div>
    </div>
  );
}

function AnalyticsPanel({ a }: { a: VedaAnalytics | null }) {
  if (!a) return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sw-ink-400)', fontSize: 14 }}>Analytics unavailable.</div>;
  const f = a.funnel;
  const max = Math.max(f.totalLeads, 1);
  const tiles = [
    { label: 'Cost / booking', value: a.cost.perBookingUsd === '—' ? '—' : `$${a.cost.perBookingUsd}` },
    { label: 'Total AI spend', value: `$${a.cost.totalUsd}` },
    { label: 'Avg chat reply', value: a.avgChatReplyMs ? `${(a.avgChatReplyMs / 1000).toFixed(1)}s` : '—' },
    { label: 'Knowledge entries', value: a.knowledgeEntries },
  ];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--sw-ink-900)' }}>{t.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--sw-ink-400)', marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <SectionTitle>Conversion funnel</SectionTitle>
      <div style={{ marginBottom: 24 }}>
        <FunnelBar label="Leads" value={f.totalLeads} max={max} color="#2563eb" />
        <FunnelBar label={`Qualified by Veda · ${a.conversion.qualifyRate}%`} value={f.qualified} max={max} color="#7c3aed" />
        <FunnelBar label={`Discovery calls · ${a.conversion.callRate}% of qualified`} value={f.discoveryCalls} max={max} color="#0d9488" />
        <FunnelBar label={`Bookings · ${a.conversion.bookingRate}% of calls`} value={f.bookings} max={max} color="#059669" />
      </div>

      <SectionTitle>Outbound by channel</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Email', value: a.channels.email },
          { label: 'WhatsApp', value: a.channels.whatsapp },
          { label: 'Voice', value: a.channels.voice },
          { label: 'Chat replies', value: a.channels.chat },
        ].map((c) => (
          <div key={c.label} style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sw-forest-800)' }}>{c.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--sw-ink-400)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <SectionTitle>Nurture sequences</SectionTitle>
      <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
        <span><b style={{ color: '#0d9488' }}>{a.nurture.active}</b> <span style={{ color: 'var(--sw-ink-400)' }}>active</span></span>
        <span><b style={{ color: '#059669' }}>{a.nurture.completed}</b> <span style={{ color: 'var(--sw-ink-400)' }}>completed</span></span>
        <span><b style={{ color: '#6b7280' }}>{a.nurture.stopped}</b> <span style={{ color: 'var(--sw-ink-400)' }}>stopped</span></span>
      </div>
    </div>
  );
}

// --- Knowledge base ---------------------------------------------------------

function KnowledgePanel({
  entries, isAdmin, onAdd, onToggle, onRemove,
}: {
  entries: KnowledgeEntry[];
  isAdmin: boolean;
  onAdd: (title: string, content: string, category: string) => void;
  onToggle: (e: KnowledgeEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--sw-sand-200)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  function submit() {
    if (!title.trim() || !content.trim()) return;
    onAdd(title.trim(), content.trim(), category.trim());
    setTitle(''); setContent(''); setCategory('');
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)', marginBottom: 16, lineHeight: 1.5 }}>
        What Veda knows — programs, pricing, policies, FAQs. Veda pulls the most relevant entries into every chat, call, and email answer.
      </div>

      {isAdmin && (
        <div style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 2 }} placeholder="Title (e.g. 14-Day Foundations Program)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="What should Veda know? (details, pricing, policy…)" value={content} onChange={(e) => setContent(e.target.value)} />
          <div>
            <button
              onClick={submit}
              disabled={!title.trim() || !content.trim()}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                cursor: title.trim() && content.trim() ? 'pointer' : 'default',
                background: 'var(--sw-forest-700)', color: '#fff', fontSize: 13, fontWeight: 600,
                opacity: title.trim() && content.trim() ? 1 : 0.5,
              }}
            >
              Add to Veda’s knowledge
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--sw-ink-400)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
          No knowledge yet — add programs, pricing, and FAQs so Veda answers accurately.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: 14, opacity: e.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--sw-ink-900)' }}>{e.title}</span>
                    {e.category && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'var(--sw-sand-100)', color: 'var(--sw-ink-400)' }}>{e.category}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)', lineHeight: 1.5 }}>{e.content}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onToggle(e)} title={e.active ? 'Disable' : 'Enable'} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--sw-ink-400)' }}>
                      {e.active ? 'On' : 'Off'}
                    </button>
                    <button onClick={() => onRemove(e.id)} title="Delete" style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#dc2626' }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
