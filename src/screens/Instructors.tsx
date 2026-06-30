import { useState } from 'react';
import type { AppStore } from '../store';
import { ApiError } from '../api/client';
import { instructorsApi, useInstructors } from '../api/instructors';
import { Callout } from '../components/ui';

const cardStyle = { background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '20px 22px' } as const;
const h2Style = { margin: '0 0 14px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' } as const;
const inputStyle = { width: '100%', height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13, background: '#fff' } as const;

export function Instructors({ app }: { app: AppStore }) {
  const { data, loading, refresh } = useInstructors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (name.trim().length < 2) { app.showToastMsg('Instructor ka naam daalo.'); return; }
    if (!email.includes('@')) { app.showToastMsg('Sahi email daalo.'); return; }
    if (password.length < 10) { app.showToastMsg('Password kam se kam 10 characters ka ho (ek letter + ek number).'); return; }
    setBusy(true);
    try {
      await instructorsApi.create(name.trim(), email.trim(), password);
      app.showToastMsg(`Instructor ${name.trim()} ban gaya ✅`);
      setName(''); setEmail(''); setPassword('');
      await refresh();
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Instructor nahi ban paya.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, makeActive: boolean) {
    try {
      await instructorsApi.setActive(id, makeActive);
      app.showToastMsg(makeActive ? 'Instructor active kar diya.' : 'Instructor disable kar diya.');
      await refresh();
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Update nahi hua.');
    }
  }

  async function resetPassword(id: string, nameLabel: string) {
    const pw = window.prompt(`New password for ${nameLabel} (min 10 chars, a letter + a number):`);
    if (pw === null) return;
    if (pw.length < 10) { app.showToastMsg('Password kam se kam 10 characters ka ho.'); return; }
    try {
      await instructorsApi.setPassword(id, pw);
      app.showToastMsg('Password reset ho gaya ✅');
    } catch (e) {
      app.showToastMsg(e instanceof ApiError ? e.message : 'Password reset nahi hua.');
    }
  }

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1040, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Instructors</h1>
      <p style={{ margin: '6px 0 22px', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>
        Teachers jo live classes host karte hain. Ye CRM staff se alag hain — inhe sirf <code>/teach</code> par login milta hai.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        {/* create */}
        <section style={cardStyle}>
          <h2 style={h2Style}>Add instructor</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sw-stone-600)', marginBottom: 5 }}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Sharma" style={inputStyle} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sw-stone-600)', marginBottom: 5 }}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@shreevanwellness.com" style={inputStyle} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--sw-stone-600)', marginBottom: 5 }}>Temporary password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 10 chars, a letter + a number"
                onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} style={inputStyle} />
            </label>
            <Callout variant="information">Instructor ko ye email + password share karo. Wo <code>/teach</code> par sign in karega.</Callout>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => void create()} disabled={busy} className="hov-forest-deep"
                style={{ height: 36, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Creating…' : 'Create instructor'}
              </button>
            </div>
          </div>
        </section>

        {/* list */}
        <section style={cardStyle}>
          <h2 style={h2Style}>All instructors</h2>
          {loading && <p style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading…</p>}
          {!loading && data.length === 0 && <p style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>Abhi koi instructor nahi. Bayein se ek banao.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--sw-line-soft)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--sw-ink-900)' }}>{i.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: i.isActive ? 'var(--sw-moss-600)' : 'var(--sw-stone-600)', background: i.isActive ? 'rgba(74,124,89,0.12)' : 'var(--sw-line-soft)', borderRadius: 999, padding: '2px 8px' }}>{i.isActive ? 'Active' : 'Disabled'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => void resetPassword(i.id, i.name)} style={ghost}>Reset password</button>
                  <button onClick={() => void toggleActive(i.id, !i.isActive)} style={ghost}>{i.isActive ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const ghost = { height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: 'var(--sw-ink-900)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const;
