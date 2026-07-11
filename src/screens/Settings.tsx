import { useEffect, useState } from 'react';
import type { AppStore } from '../store';
import { ApiError } from '../api/client';
import {
  changePassword, get2faStatus, setup2fa, enable2fa, disable2fa,
  type TwoFactorSetup,
} from '../api/auth';
import { Callout, PasswordInput } from '../components/ui';
import { CHANNEL_LABEL } from '../api/enquiries';
import {
  isAdmin, roleLabel, useManageUsers, useUsers, usersApi,
  type ManageUser, type NewUser, type Role,
} from '../api/users';
import { useStages } from '../api/leads';
import { CONN_STATUS, useChannels, useRoutingRules, useSlaPolicies } from '../api/settings';
import { SCREENS, type ScreenKey } from '../types';

// Avatar background: admins get the deep forest, everyone else a neutral member tone.
const avatarBg = (role: string) => (role === 'ADMIN' ? 'var(--sw-forest-900)' : 'var(--sw-gold-500)');

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

        <PasswordCard app={app} />

        <TwoFactorCard app={app} />

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

/* ---------------- Your account: change password ---------------- */

function PasswordCard({ app }: { app: AppStore }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!current || !next) { app.showToastMsg('Current aur new password dono bharo.'); return; }
    if (next.length < 8) { app.showToastMsg('New password kam se kam 8 characters ka ho.'); return; }
    if (next !== confirm) { app.showToastMsg('New password aur confirm match nahi kar rahe.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      app.showToastMsg('Password badal diya gaya ✅');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Password change nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--sw-stone-600)', marginBottom: 5 }}>{label}</span>
      <PasswordInput value={value} placeholder={placeholder} autoComplete="off"
        onChange={set}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        style={inputStyle} />
    </label>
  );

  return (
    <section style={cardStyle}>
      <h2 style={{ ...h2Style, marginBottom: 6 }}>Your account</h2>
      <p style={{ margin: '0 0 14px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Apna login password yahan se badlo.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {field('Current password', current, setCurrent, 'Abhi wala password')}
        {field('New password', next, setNext, 'Kam se kam 8 characters')}
        {field('Confirm new password', confirm, setConfirm, 'Dobara new password')}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => void submit()} disabled={busy} className="hov-forest-deep"
            style={{ height: 36, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Your account: two-factor authentication ---------------- */

type TwoFactorMode = 'idle' | 'enrolling' | 'backup' | 'disabling';

function TwoFactorCard({ app }: { app: AppStore }) {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [mode, setMode] = useState<TwoFactorMode>('idle');
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    get2faStatus()
      .then((s) => { if (live) setEnabled(s.enabled); })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);

  function reset() {
    setMode('idle'); setSetupData(null); setCode(''); setBusy(false);
  }

  async function beginEnrol() {
    setBusy(true);
    try {
      const data = await setup2fa();
      setSetupData(data);
      setCode('');
      setMode('enrolling');
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : '2FA setup shuru nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    const clean = code.replace(/\s/g, '');
    if (clean.length < 6) { app.showToastMsg('6-digit code daalo.'); return; }
    setBusy(true);
    try {
      const { backupCodes: codes } = await enable2fa(clean);
      setBackupCodes(codes);
      setEnabled(true);
      setMode('backup');
      setCode('');
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Code galat hai — dobara try karo.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    const clean = code.replace(/\s/g, '');
    if (clean.length < 6) { app.showToastMsg('Confirm karne ke liye code daalo.'); return; }
    setBusy(true);
    try {
      await disable2fa(clean);
      setEnabled(false);
      app.showToastMsg('Two-factor authentication band kar di gayi.');
      reset();
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Code galat hai — 2FA off nahi hui.');
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (onEnter: () => void) => (
    <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} placeholder="123456"
      onChange={(e) => setCode(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
      style={{ ...inputStyle, letterSpacing: '0.25em', textAlign: 'center' }} />
  );

  const primaryBtn = (label: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={busy || disabled} className="hov-forest-deep"
      style={{ height: 36, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: busy || disabled ? 'default' : 'pointer', opacity: busy || disabled ? 0.6 : 1 }}>
      {busy ? 'Working…' : label}
    </button>
  );

  const ghostBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} disabled={busy}
      style={{ height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: 'var(--sw-ink-900)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
      {label}
    </button>
  );

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <h2 style={{ ...h2Style, marginBottom: 0 }}>Two-factor authentication</h2>
        {enabled !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: enabled ? 'var(--sw-moss-600)' : 'var(--sw-stone-600)', background: enabled ? 'rgba(74,124,89,0.12)' : 'var(--sw-line-soft)', borderRadius: 999, padding: '3px 10px' }}>
            {enabled ? 'On' : 'Off'}
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 14px 0', fontSize: 12.5, color: 'var(--sw-stone-600)' }}>
        Login par authenticator app ka 6-digit code maanga jayega — account ki extra suraksha.
      </p>

      {enabled === null && <p style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading…</p>}

      {/* Idle: show enable or disable entry point */}
      {enabled !== null && mode === 'idle' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {enabled
            ? ghostBtn('Turn off', () => { setCode(''); setMode('disabling'); })
            : primaryBtn('Enable 2FA', () => void beginEnrol())}
        </div>
      )}

      {/* Enrolling: QR + manual key + first code */}
      {mode === 'enrolling' && setupData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--sw-ink-900)', lineHeight: 1.6 }}>
            <li>Scan this QR in Google Authenticator / Authy.</li>
            <li>Enter the 6-digit code it shows to finish.</li>
          </ol>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={setupData.qrDataUrl} alt="2FA QR code" width={132} height={132} style={{ borderRadius: 8, border: '1px solid var(--sw-line-soft)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--sw-stone-600)', marginBottom: 4 }}>Can’t scan? Enter this key:</div>
              <code style={{ fontSize: 12, wordBreak: 'break-all', background: 'var(--sw-line-soft)', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>{setupData.secret}</code>
            </div>
          </div>
          {codeInput(() => void confirmEnable())}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {ghostBtn('Cancel', reset)}
            {primaryBtn('Verify & turn on', () => void confirmEnable())}
          </div>
        </div>
      )}

      {/* Backup codes (shown once) */}
      {mode === 'backup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Callout variant="warning">Save these backup codes somewhere safe. Each works once if you lose your phone — they won’t be shown again.</Callout>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {backupCodes.map((c) => (
              <code key={c} style={{ fontSize: 13, textAlign: 'center', background: 'var(--sw-line-soft)', borderRadius: 6, padding: '6px 0', letterSpacing: '0.04em' }}>{c}</code>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {primaryBtn('Done', reset)}
          </div>
        </div>
      )}

      {/* Disabling: confirm with a code */}
      {mode === 'disabling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sw-ink-900)' }}>Enter a current code (or a backup code) to turn 2FA off.</p>
          {codeInput(() => void confirmDisable())}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {ghostBtn('Cancel', reset)}
            {primaryBtn('Turn off 2FA', () => void confirmDisable())}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- Team cards ---------------- */

function RoleBadge({ user }: { user: { role: Role; title?: string } }) {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--sw-mist-100)', color: 'var(--sw-forest-700)', padding: '3px 10px', borderRadius: 6 }}>{roleLabel(user)}</span>;
}

function ReadonlyTeam() {
  const users = useUsers();
  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>Team &amp; roles</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {users.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < users.length - 1 ? '1px solid var(--sw-mist-100)' : 'none' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: avatarBg(u.role), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 }}>{initials(u.name)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--sw-stone-600)' }}>{roleLabel(u)}</div>
            </div>
            <RoleBadge user={u} />
          </div>
        ))}
        {users.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading team…</div>}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 11.5, color: 'var(--sw-stone-600)' }}>Only an admin can invite teammates or change access.</p>
    </section>
  );
}

/** Checkbox grid for choosing which CRM screens a user can access. */
function ScreenPicker({ value, onChange }: { value: ScreenKey[]; onChange: (next: ScreenKey[]) => void }) {
  const toggle = (key: ScreenKey) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
      {SCREENS.filter((s) => s.key !== 'settings').map((s) => (
        <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer', color: 'var(--sw-ink-900)' }}>
          <input type="checkbox" checked={value.includes(s.key)} onChange={() => toggle(s.key)} style={{ cursor: 'pointer' }} />
          {s.label}
        </label>
      ))}
    </div>
  );
}

function AdminTeam({ app }: { app: AppStore }) {
  const { users, reload } = useManageUsers();
  const [inviting, setInviting] = useState(false);
  const emptyForm: NewUser = { email: '', name: '', role: 'RELATIONSHIP', title: '', password: '', allowedScreens: [] };
  const [form, setForm] = useState<NewUser>(emptyForm);
  const [editingAccess, setEditingAccess] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); app.showToastMsg(ok); reload(); }
    catch (e) { app.showToastMsg(e instanceof ApiError ? e.message : 'Action failed.'); }
  }

  async function invite() {
    if (!form.email.trim() || !form.name.trim() || form.password.length < 10) { app.showToastMsg('Name, email and a 10+ char password (incl. a number) are required.'); return; }
    await run(() => usersApi.create(form), `${form.name} added to the team.`);
    setForm(emptyForm);
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
          <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Role / title (e.g. Relationship Manager)" style={inputStyle} />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (10+ chars, incl. a number)" type="text" style={inputStyle} />
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--sw-ink-900)' }}>
            <input type="checkbox" checked={form.role === 'ADMIN'} onChange={(e) => setForm({ ...form, role: e.target.checked ? 'ADMIN' : 'RELATIONSHIP' })} style={{ cursor: 'pointer' }} />
            Admin (full access to every screen)
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sw-stone-600)', marginBottom: 8 }}>
              Screen access {form.role === 'ADMIN' && '(admins see everything)'}
            </div>
            {form.role === 'ADMIN' ? (
              <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Admins have access to every screen — nothing to configure.</div>
            ) : (
              <ScreenPicker value={form.allowedScreens ?? []} onChange={(next) => setForm({ ...form, allowedScreens: next })} />
            )}
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={invite} className="hov-forest-deep" style={{ height: 34, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add teammate</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {users.map((u: ManageUser, i) => (
          <div key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--sw-mist-100)' : 'none', opacity: u.isActive ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: avatarBg(u.role), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{initials(u.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}{!u.isActive && <span style={{ fontSize: 11, color: 'var(--sw-stone-600)', fontWeight: 400 }}> · disabled</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              </div>
              {u.role === 'ADMIN' ? (
                <span style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-forest-700)', flexShrink: 0 }}>Admin</span>
              ) : (
                <input
                  key={`title-${u.id}-${u.title}`}
                  defaultValue={u.title}
                  placeholder="Role / title"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (u.title ?? '')) run(() => usersApi.setTitle(u.id, v), `Updated ${u.name}'s title.`); }}
                  style={{ height: 32, width: 160, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#fff', fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--sw-ink-900)', padding: '0 10px', flexShrink: 0 }}
                />
              )}
              <button onClick={() => setEditingAccess((cur) => (cur === u.id ? null : u.id))} className="hov-mist"
                title={u.role === 'ADMIN' ? 'Admins see every screen' : `${u.allowedScreens.length} screens`}
                style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: editingAccess === u.id ? 'var(--sw-mist-100)' : '#fff', color: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {u.role === 'ADMIN' ? 'All access' : `Access · ${u.allowedScreens.length}`}
              </button>
              <button onClick={() => run(() => usersApi.updateRole(u.id, u.role === 'ADMIN' ? 'RELATIONSHIP' : 'ADMIN'), `${u.name} is now ${u.role === 'ADMIN' ? 'a member' : 'an admin'}.`)} className="hov-mist"
                title={u.role === 'ADMIN' ? 'Remove admin (make a member)' : 'Make admin (full access)'}
                style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: u.role === 'ADMIN' ? 'var(--sw-forest-900)' : '#fff', color: u.role === 'ADMIN' ? '#fff' : 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {u.role === 'ADMIN' ? 'Admin ✓' : 'Make admin'}
              </button>
              <button onClick={() => run(() => usersApi.setActive(u.id, !u.isActive), `${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}.`)} className="hov-mist"
                style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: u.isActive ? 'var(--sw-error)' : 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {u.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
            {editingAccess === u.id && (
              <div style={{ padding: '4px 0 16px 46px' }}>
                {u.role === 'ADMIN' ? (
                  <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Admins have access to every screen — nothing to configure.</div>
                ) : (
                  <ScreenPicker
                    value={u.allowedScreens}
                    onChange={(next) => run(() => usersApi.setScreens(u.id, next), `Updated ${u.name}'s screen access.`)}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)' }}>Loading team…</div>}
      </div>
    </section>
  );
}
