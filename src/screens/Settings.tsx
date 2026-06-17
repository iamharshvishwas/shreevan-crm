import { useState } from 'react';
import type { AppStore } from '../store';
import { ApiError } from '../api/client';
import { Callout } from '../components/ui';
import { CHANNEL_LABEL } from '../api/enquiries';
import {
  ROLES, ROLE_LABEL, isAdmin, useManageUsers, useUsers, usersApi,
  type ManageUser, type NewUser, type Role,
} from '../api/users';
import { useStages } from '../api/leads';
import { CONN_STATUS, useChannels, useRoutingRules, useSlaPolicies } from '../api/settings';

const ROLE_TAG: Record<Role, string> = { ADMIN: 'Admin', RELATIONSHIP: 'Member', MARKETING: 'Member', OPERATIONS: 'Member' };
const ROLE_BG: Record<Role, string> = { ADMIN: 'var(--sw-forest-900)', RELATIONSHIP: 'var(--sw-gold-500)', MARKETING: 'var(--sw-moss-600)', OPERATIONS: 'var(--sw-river-600)' };

const NOTIF_PREFS = [
  { label: 'New enquiry received', checked: true },
  { label: 'Follow-up due or overdue', checked: true },
  { label: 'Discovery call reminders (30 min before)', checked: true },
  { label: 'Payment received', checked: false },
  { label: 'Weekly pipeline summary email', checked: false },
];

const cardStyle = { background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '20px 22px' } as const;
const h2Style = { margin: '0 0 14px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' } as const;
const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const inputStyle = { width: '100%', height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13, background: '#fff' } as const;

export function Settings({ app }: { app: AppStore }) {
  const users = useUsers(); // active users, for routing-rule name resolution
  const channels = useChannels();
  const slaPolicies = useSlaPolicies();
  const routingRules = useRoutingRules();
  const stages = useStages();
  const admin = isAdmin();

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1040, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Settings</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24, alignItems: 'start' }}>
        {admin ? <AdminTeam app={app} /> : <ReadonlyTeam />}

        {/* Notifications (preferences — local) */}
        <section style={cardStyle}>
          <h2 style={{ ...h2Style, marginBottom: 6 }}>Notifications</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Email and in-app alerts for your account.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {NOTIF_PREFS.map((n) => (
              <label key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--sw-ink-900)', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={n.checked} style={{ width: 16, height: 16, accentColor: '#173d32' }} />
                {n.label}
              </label>
            ))}
          </div>
        </section>

        {/* Channel connections */}
        <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <h2 style={{ ...h2Style, marginBottom: 6 }}>Channel connections</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>
            Where enquiries arrive. Live providers need a verified webhook + stored credentials — channels marked “Simulated” run on local fixtures.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(channels ?? []).map((c, i) => {
              const st = CONN_STATUS[c.status];
              const needsAction = c.status === 'TOKEN_EXPIRING' || c.status === 'DISCONNECTED' || c.status === 'NOT_CONFIGURED';
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < (channels?.length ?? 0) - 1 ? '1px solid var(--sw-mist-100)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{CHANNEL_LABEL[c.channel]} <span style={{ fontWeight: 400, color: 'var(--sw-stone-600)' }}>· {c.label}</span></div>
                    {c.detail && <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 1 }}>{c.detail}</div>}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: st.fg }} />{st.label}</span>
                  {needsAction && admin && (
                    <button onClick={() => app.showToastMsg(`Reconnect flow for ${c.label} would open here (requires provider credentials).`)} className="hov-mist" style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: '#fff', color: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c.status === 'NOT_CONFIGURED' ? 'Connect' : 'Reconnect'}</button>
                  )}
                </div>
              );
            })}
            {!channels && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading channels…</div>}
          </div>
        </section>

        {/* SLA policies */}
        <section style={cardStyle}>
          <h2 style={{ ...h2Style, marginBottom: 6 }}>Response-time (SLA) policies</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Editing requires the admin role.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(slaPolicies ?? []).map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 58, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--sw-forest-900)' }}>{p.firstResponseMins}m</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{p.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)' }}>{p.appliesTo}{p.pauseWhenWaitingCustomer ? ' · pauses while waiting on customer' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Routing rules */}
        <section style={cardStyle}>
          <h2 style={{ ...h2Style, marginBottom: 6 }}>Routing rules</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Applied top-down when a conversation is created.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(routingRules ?? []).map((r) => {
              const when = r.whenCountry ? `Country is ${r.whenCountry}` : r.whenChannel ? `Channel is ${CHANNEL_LABEL[r.whenChannel]}` : 'Any';
              const assignTo = users.find((u) => u.id === r.assignToUserId)?.name ?? '—';
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--sw-mist-100)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{r.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)' }}>{when} → {assignTo}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: r.enabled ? '#e4efe8' : '#ece4d3', color: r.enabled ? '#2e6a4d' : '#5e6863' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: r.enabled ? '#2e6a4d' : '#5e6863' }} />{r.enabled ? 'On' : 'Off'}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pipeline stages */}
        <section style={cardStyle}>
          <h2 style={{ ...h2Style, marginBottom: 6 }}>Pipeline stages</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>The booking pipeline order. Editing stages requires the admin role.</p>
          <ol style={{ margin: 0, padding: '0 0 0 2px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stages.map((s, i) => {
              const badge = s.isTerminalWon ? { bg: 'var(--sw-success-bg)', fg: 'var(--sw-success)' } : s.isTerminalLost ? { bg: 'var(--sw-error-bg)', fg: 'var(--sw-error)' } : { bg: 'var(--sw-mist-100)', fg: 'var(--sw-forest-700)' };
              return (
                <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--sw-ink-900)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: badge.bg, color: badge.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                  {s.label}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Policy callouts */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14, gridColumn: '1 / -1' }}>
          <Callout variant="disclaimer" title="Health information policy">
            This CRM stores administrative screening statuses only — for example "Health screening completed". Detailed medical information must never be recorded here; it stays with the guest's screening practitioner.
          </Callout>
          <Callout variant="information" title="Data retention">
            Closed-lost leads are retained for 18 months for re-engagement (for example, October cohort reminders), then anonymised.
          </Callout>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Team cards ---------------- */

function RoleBadge({ role }: { role: Role }) {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--sw-mist-100)', color: 'var(--sw-forest-700)', padding: '3px 10px', borderRadius: 6 }}>{ROLE_TAG[role]}</span>;
}

function ReadonlyTeam() {
  const users = useUsers();
  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>Team &amp; roles</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < users.length - 1 ? '1px solid var(--sw-mist-100)' : 'none' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_BG[u.role], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 }}>{initials(u.name)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--sw-stone-600)' }}>{ROLE_LABEL[u.role]}</div>
            </div>
            <RoleBadge role={u.role} />
          </div>
        ))}
        {users.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading team…</div>}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 11.5, color: 'var(--sw-stone-600)' }}>Only an admin can change roles or invite teammates.</p>
    </section>
  );
}

function AdminTeam({ app }: { app: AppStore }) {
  const { users, reload } = useManageUsers();
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState<NewUser>({ email: '', name: '', role: 'RELATIONSHIP', password: '' });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); app.showToastMsg(ok); reload(); }
    catch (e) { app.showToastMsg(e instanceof ApiError ? e.message : 'Action failed.'); }
  }

  async function invite() {
    if (!form.email.trim() || !form.name.trim() || form.password.length < 8) { app.showToastMsg('Name, email and an 8+ char password are required.'); return; }
    await run(() => usersApi.create(form), `${form.name} added to the team.`);
    setForm({ email: '', name: '', role: 'RELATIONSHIP', password: '' });
    setInviting(false);
  }

  return (
    <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ ...h2Style, marginBottom: 0 }}>Team &amp; roles</h2>
        <button onClick={() => setInviting((v) => !v)} className="hov-mist" style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: inviting ? 'var(--sw-mist-100)' : '#fff', color: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          {inviting ? 'Cancel' : 'Invite teammate'}
        </button>
      </div>

      {inviting && (
        <div style={{ background: 'var(--sw-sand-050)', border: '1px solid var(--sw-line-soft)', borderRadius: 10, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" style={inputStyle} />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" style={inputStyle} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (8+ chars)" type="text" style={inputStyle} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={invite} className="hov-forest-deep" style={{ height: 34, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add teammate</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {users.map((u: ManageUser, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < users.length - 1 ? '1px solid var(--sw-mist-100)' : 'none', opacity: u.isActive ? 1 : 0.55 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_BG[u.role], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{initials(u.name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}{!u.isActive && <span style={{ fontSize: 11, color: 'var(--sw-stone-600)', fontWeight: 400 }}> · disabled</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
            </div>
            <select value={u.role} onChange={(e) => run(() => usersApi.updateRole(u.id, e.target.value as Role), `${u.name} is now ${ROLE_LABEL[e.target.value as Role]}.`)}
              style={{ height: 32, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#fff', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)', padding: '0 8px', cursor: 'pointer', flexShrink: 0 }}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button onClick={() => run(() => usersApi.setActive(u.id, !u.isActive), `${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}.`)} className="hov-mist"
              style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: u.isActive ? 'var(--sw-error)' : 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {u.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
        {users.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading team…</div>}
      </div>
    </section>
  );
}
