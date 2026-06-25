import { useEffect, useState, useCallback } from 'react';
import type { AppStore } from '../store';
import { vedaApi, type VedaConfig, type VedaApproval, type VedaActionLog, type VedaSummary, type VedaAnalytics, type KnowledgeEntry, type KnowledgeGap } from '../api/veda';
import { useAuth } from '../auth/useAuth';

const STEP_LABELS: Record<string, { label: string; desc: string; phase: string }> = {
  QUALIFY_LEAD:  { label: 'Lead Qualification',  desc: 'Extract program, budget, language & urgency from every new lead', phase: 'Phase 1' },
  SEND_EMAIL:    { label: 'Auto Email',           desc: 'Draft personalised follow-up emails for approval before sending',   phase: 'Phase 1' },
  SEND_WHATSAPP: { label: 'WhatsApp Messages',    desc: 'Send WhatsApp greetings & slot-scheduling via Meta Cloud API',      phase: 'Phase 2' },
  VOICE_CALL:    { label: 'AI Voice Calls',       desc: 'Outbound discovery calls via Vapi/Retell with Hindi+English',      phase: 'Phase 3' },
  CHAT_REPLY:    { label: 'Live Chat Replies',    desc: 'Veda chats in real time on the website widget & WhatsApp (auto-replies instantly)', phase: 'Live chat' },
  NURTURE:       { label: 'Nurture Sequences',    desc: 'Multi-touch follow-up (email + WhatsApp) for cold leads until they reply or convert', phase: 'Nurture' },
  SELF_LEARN:    { label: 'Self-Learning',        desc: 'Veda spots questions it can’t answer, learns the answer, and grows its own knowledge (auto-applies safe entries, queues sensitive ones)', phase: 'Learning' },
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
  const [gaps, setGaps]             = useState<KnowledgeGap[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [activeTab, setActiveTab]   = useState<'pending' | 'history' | 'analytics' | 'knowledge' | 'learning'>('pending');

  const load = useCallback(async () => {
    try {
      const [cfg, appr, lg, sum, an, kb, gp] = await Promise.all([
        isAdmin ? vedaApi.getConfig() : Promise.resolve(null),
        vedaApi.listApprovals('PENDING'),
        vedaApi.getLogs(20),
        vedaApi.getSummary(),
        vedaApi.getAnalytics().catch(() => null),
        vedaApi.listKnowledge().catch(() => []),
        vedaApi.listGaps().catch(() => []),
      ]);
      if (cfg) setConfig(cfg);
      setApprovals(appr.items);
      setLogs(lg.items);
      setSummary(sum);
      setAnalytics(an);
      setKnowledge(kb);
      setGaps(gp);
    } catch {
      // non-fatal — show whatever loaded
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  // Live refresh: poll every 12s + on tab focus, so approvals/logs auto-update.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(); };
    const id = window.setInterval(tick, 12_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(id); window.removeEventListener('focus', tick); };
  }, [load]);

  const [testingEmail, setTestingEmail] = useState(false);
  async function sendTestEmail() {
    setTestingEmail(true);
    try {
      const to = window.prompt('Send a test email to:', auth.user?.email ?? '') ?? '';
      if (!to.trim()) return;
      const r = await vedaApi.testEmail(to.trim());
      app.showToastMsg(r.simulated ? `Simulated (not configured): ${r.detail}` : `Test email sent to ${r.to} ✓`);
    } catch {
      app.showToastMsg('Test email failed — check email settings / logs');
    } finally {
      setTestingEmail(false);
    }
  }

  const [testingCall, setTestingCall] = useState(false);
  async function placeTestCall() {
    setTestingCall(true);
    try {
      const to = window.prompt('Place a test call to (E.164, e.g. +9198…):', '') ?? '';
      if (!to.trim()) return;
      const r = await vedaApi.testCall(to.trim());
      if (r.error) app.showToastMsg(r.error);
      else app.showToastMsg(r.simulated ? `Simulated (Vapi not configured): ${r.detail}` : `Calling ${r.to} now ✓ — transcript will appear in Discovery Calls`);
    } catch {
      app.showToastMsg('Test call failed — check Vapi settings / logs');
    } finally {
      setTestingCall(false);
    }
  }

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

  async function editKnowledge(id: string, title: string, content: string, category: string) {
    try {
      const updated = await vedaApi.updateKnowledge(id, { title, content, category: category || undefined });
      setKnowledge((prev) => prev.map((k) => (k.id === id ? updated : k)));
      app.showToastMsg('Knowledge updated');
    } catch {
      app.showToastMsg('Failed to update knowledge');
    }
  }

  async function importPrograms() {
    try {
      const r = await vedaApi.importPrograms();
      const list = await vedaApi.listKnowledge().catch(() => knowledge);
      setKnowledge(list);
      app.showToastMsg(r.created > 0 ? `Imported ${r.created} program(s) into Veda` : 'Programs already imported');
    } catch {
      app.showToastMsg('Failed to import programs');
    }
  }

  async function seedShreevan() {
    try {
      app.showToastMsg('Loading Shreevan knowledge… (embedding, give it a moment)');
      const r = await vedaApi.seedShreevan();
      const list = await vedaApi.listKnowledge().catch(() => knowledge);
      setKnowledge(list);
      app.showToastMsg(`Shreevan knowledge loaded — ${r.created} new, ${r.updated} updated, ${r.skipped} unchanged${r.removed ? `, ${r.removed} pruned` : ''}`);
    } catch {
      app.showToastMsg('Failed to load Shreevan knowledge');
    }
  }

  async function approveGap(id: string) {
    try {
      await vedaApi.approveGap(id);
      const [gp, kb] = await Promise.all([vedaApi.listGaps().catch(() => gaps), vedaApi.listKnowledge().catch(() => knowledge)]);
      setGaps(gp); setKnowledge(kb);
      app.showToastMsg('Added to Veda’s knowledge ✓');
    } catch {
      app.showToastMsg('Failed to approve');
    }
  }

  async function dismissGap(id: string) {
    try {
      await vedaApi.dismissGap(id);
      setGaps(await vedaApi.listGaps().catch(() => gaps));
    } catch {
      app.showToastMsg('Failed to dismiss');
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
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sw-sand-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)' }}>Verify channels with a quick test.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={sendTestEmail}
                disabled={testingEmail}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-forest-800)', whiteSpace: 'nowrap', opacity: testingEmail ? 0.6 : 1 }}
              >
                {testingEmail ? 'Sending…' : 'Send test email'}
              </button>
              <button
                onClick={placeTestCall}
                disabled={testingCall}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-forest-800)', whiteSpace: 'nowrap', opacity: testingCall ? 0.6 : 1 }}
              >
                {testingCall ? 'Calling…' : 'Place test call'}
              </button>
            </div>
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
          {(['pending', 'history', 'analytics', 'knowledge', 'learning'] as const).map((tab) => (
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
                : tab === 'knowledge' ? `Knowledge${knowledge.length ? ` (${knowledge.length})` : ''}`
                : `Learning${gaps.filter((g) => g.status === 'PENDING').length ? ` (${gaps.filter((g) => g.status === 'PENDING').length})` : ''}`}
            </button>
          ))}
        </div>

        {activeTab === 'analytics' && <AnalyticsPanel a={analytics} />}
        {activeTab === 'learning' && (
          <LearningPanel gaps={gaps} isAdmin={isAdmin} onApprove={approveGap} onDismiss={dismissGap} />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgePanel
            entries={knowledge}
            isAdmin={isAdmin}
            onAdd={addKnowledge}
            onEdit={editKnowledge}
            onToggle={toggleKnowledge}
            onRemove={removeKnowledge}
            onImportPrograms={importPrograms}
            onSeedShreevan={seedShreevan}
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

const KB_TEMPLATES: { title: string; category: string; scaffold: string }[] = [
  { title: "What's included in a retreat", category: 'Programs', scaffold: 'Each retreat includes: accommodation, all sattvic meals, daily yoga & meditation sessions, wellness consultations, and … (list everything a guest gets).' },
  { title: 'Pricing & payment', category: 'Pricing', scaffold: 'Programs range from ₹… to ₹…. Booking needs a deposit of …, balance due by …. We accept … . Refund window: … .' },
  { title: 'Cancellation & refund policy', category: 'Policies', scaffold: 'Cancellations made … days before arrival: … refund. Within … days: … . Date changes: … .' },
  { title: 'Daily schedule', category: 'Logistics', scaffold: 'A typical day: 6:30am pranayama, 8am breakfast, … , evening meditation. (Outline a sample day.)' },
  { title: 'Travel & how to reach', category: 'Logistics', scaffold: 'Location: … . Nearest airport/station: … . Airport transfers: … . Best time to arrive: … .' },
  { title: 'Food & dietary options', category: 'Logistics', scaffold: 'We serve sattvic vegetarian meals. We can accommodate: vegan, gluten-free, … . Please share dietary needs in advance.' },
  { title: 'Who our retreats are for', category: 'About', scaffold: 'Our retreats are ideal for … . Suitable for beginners? … . Age range: … .' },
];

function LearningPanel({
  gaps, isAdmin, onApprove, onDismiss,
}: {
  gaps: KnowledgeGap[];
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const pending = gaps.filter((g) => g.status === 'PENDING');
  const open = gaps.filter((g) => g.status === 'OPEN').sort((a, b) => b.occurrences - a.occurrences);
  const applied = gaps.filter((g) => g.status === 'APPLIED');

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)', marginBottom: 16, lineHeight: 1.5 }}>
        Veda learns on its own: it spots questions it couldn’t answer, learns the answer when your team replies, and grows its knowledge — auto-applying safe entries and queueing pricing/health/policy ones here for your OK.
      </div>

      {/* Proposals awaiting approval */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)', marginBottom: 10 }}>
        Proposed knowledge {pending.length > 0 && <span style={{ color: '#d97706' }}>· {pending.length} need your OK</span>}
      </div>
      {pending.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--sw-ink-400)', padding: '8px 0 18px' }}>Nothing waiting — Veda auto-applies safe answers it learns.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {pending.map((g) => (
            <div key={g.id} style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: 14, background: '#fffdf7' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>{g.draftCategory ?? 'FAQ'}</span>
                <span style={{ fontSize: 10.5, color: 'var(--sw-ink-400)' }}>learned from “{g.question.slice(0, 60)}{g.question.length > 60 ? '…' : ''}”</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--sw-ink-900)', marginBottom: 3 }}>{g.draftTitle}</div>
              <div style={{ fontSize: 12.5, color: 'var(--sw-ink-600)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{g.draftContent}</div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => onApprove(g.id)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--sw-forest-700)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>✓ Add to knowledge</button>
                  <button onClick={() => onDismiss(g.id)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--sw-sand-200)', cursor: 'pointer', background: '#fff', color: 'var(--sw-ink-600)', fontSize: 12.5, fontWeight: 600 }}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unanswered questions Veda is waiting to learn */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)', marginBottom: 10 }}>
        Questions Veda couldn’t answer yet {open.length > 0 && <span style={{ color: 'var(--sw-ink-400)' }}>· {open.length}</span>}
      </div>
      {open.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--sw-ink-400)', padding: '8px 0 18px' }}>None — Veda is answering everything from its knowledge.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {open.slice(0, 20).map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-ink-600)', padding: '6px 0', borderBottom: '1px solid var(--sw-sand-100)' }}>
              {g.occurrences > 1 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#e0e7ff', color: '#3730a3' }}>×{g.occurrences}</span>}
              <span style={{ flex: 1 }}>{g.question}</span>
              {isAdmin && <button onClick={() => onDismiss(g.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--sw-ink-400)', fontSize: 12 }}>✕</button>}
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--sw-ink-400)', marginTop: 6 }}>Tip: reply to these in Live Chat — Veda captures your answer and turns it into knowledge automatically.</div>
        </div>
      )}

      {applied.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--sw-success, #15803d)', fontWeight: 600 }}>
          ✦ Veda has self-learned {applied.length} knowledge {applied.length === 1 ? 'entry' : 'entries'} so far.
        </div>
      )}
    </div>
  );
}

function KnowledgePanel({
  entries, isAdmin, onAdd, onEdit, onToggle, onRemove, onImportPrograms, onSeedShreevan,
}: {
  entries: KnowledgeEntry[];
  isAdmin: boolean;
  onAdd: (title: string, content: string, category: string) => void;
  onEdit: (id: string, title: string, content: string, category: string) => void;
  onToggle: (e: KnowledgeEntry) => void;
  onRemove: (id: string) => void;
  onImportPrograms: () => void;
  onSeedShreevan: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--sw-sand-200)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  function reset() { setTitle(''); setContent(''); setCategory(''); setEditingId(null); }

  function submit() {
    if (!title.trim() || !content.trim()) return;
    if (editingId) onEdit(editingId, title.trim(), content.trim(), category.trim());
    else onAdd(title.trim(), content.trim(), category.trim());
    reset();
  }

  function useTemplate(t: { title: string; category: string; scaffold: string }) {
    setEditingId(null);
    setTitle(t.title); setCategory(t.category); setContent(t.scaffold);
  }

  function startEdit(e: KnowledgeEntry) {
    setEditingId(e.id);
    setTitle(e.title); setContent(e.content); setCategory(e.category ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canSubmit = !!title.trim() && !!content.trim();

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--sw-ink-400)', marginBottom: 14, lineHeight: 1.5 }}>
        What Veda knows — programs, pricing, policies, FAQs. Veda pulls the most relevant entries into every chat, call, and email answer.
      </div>

      {isAdmin && (
        <>
          {/* Quick start: import programs + topic templates */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <button
              onClick={onSeedShreevan}
              style={{ padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--sw-forest-900)', color: '#fff', fontSize: 12.5, fontWeight: 700 }}
              title="Load the curated Shreevan Wellness knowledge pack (programs, pricing, policies, FAQs)"
            >
              ✦ Load Shreevan knowledge
            </button>
            <button
              onClick={onImportPrograms}
              style={{ padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--sw-forest-700)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}
            >
              ↓ Import my programs
            </button>
            <span style={{ fontSize: 12, color: 'var(--sw-ink-400)' }}>or start from a topic:</span>
            {KB_TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => useTemplate(t)}
                style={{ padding: '6px 11px', borderRadius: 999, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--sw-forest-800)' }}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Add / edit form */}
          <div style={{ border: '1px solid var(--sw-sand-200)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, background: editingId ? 'var(--sw-sand-050)' : '#fff' }}>
            {editingId && <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--sw-forest-700)' }}>EDITING ENTRY</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 2 }} placeholder="Title (e.g. 14-Day Foundations Program)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder="What should Veda know? (details, pricing, policy…)" value={content} onChange={(e) => setContent(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={submit}
                disabled={!canSubmit}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  cursor: canSubmit ? 'pointer' : 'default',
                  background: 'var(--sw-forest-700)', color: '#fff', fontSize: 13, fontWeight: 600,
                  opacity: canSubmit ? 1 : 0.5,
                }}
              >
                {editingId ? 'Save changes' : 'Add to Veda’s knowledge'}
              </button>
              {editingId && (
                <button onClick={reset} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-400)' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--sw-ink-400)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
          No knowledge yet — click <b>“Import my programs”</b> above, or add pricing & FAQs so Veda answers accurately.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--sw-ink-400)', fontWeight: 600 }}>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</div>
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
                    <button onClick={() => startEdit(e)} title="Edit" style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--sw-sand-200)', background: '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--sw-forest-800)' }}>
                      Edit
                    </button>
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
