import { FormEvent, useState } from 'react';
import { TeachApiError } from './teachApi';
import type { InstructorStore } from './useInstructor';
import { PasswordInput } from '../components/ui';

const input = { width: '100%', height: 44, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--sw-ink-900)', background: '#fff' } as const;
const label = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', marginBottom: 6 } as const;

export function InstructorAuth({ store }: { store: InstructorStore }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await store.login(email.trim(), password);
    } catch (err) {
      setError(err instanceof TeachApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', padding: 24 }}>
      <div style={{ width: 420, maxWidth: '100%', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: '34px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <img src="/assets/shreevan-mark-on-forest.png" alt="" style={{ width: 44, height: 44, borderRadius: 11 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>Shreevan Wellness</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>Instructor · Teach</div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--sw-ink-900)' }}>Instructor sign in</h1>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--sw-stone-600)' }}>Sign in to host your live classes.</p>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="iemail" style={label}>Email</label>
            <input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} autoComplete="email" placeholder="you@shreevanwellness.com" />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label htmlFor="ipass" style={label}>Password</label>
            <PasswordInput id="ipass" value={password} onChange={setPassword} style={input} autoComplete="current-password" placeholder="••••••••" />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-error)', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="hov-forest-deep"
            style={{ width: '100%', height: 44, marginTop: 20, borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0 0', fontSize: 11.5, color: 'var(--sw-stone-600)', textAlign: 'center', lineHeight: 1.5 }}>
          Instructor accounts are created by your admin. Lost access? Ask them to reset it.
        </p>
      </div>
    </div>
  );
}
