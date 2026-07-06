import { FormEvent, useState } from 'react';
import { LiveApiError } from './liveApi';
import type { ParticipantStore } from './useParticipant';
import { PasswordInput } from '../components/ui';

const input = {
  width: '100%', height: 44, border: '1px solid var(--sw-line-soft)', borderRadius: 8,
  padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--sw-ink-900)', background: '#fff',
} as const;
const label = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', marginBottom: 6 } as const;

export function ParticipantAuth({ store }: { store: ParticipantStore }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (isSignup && password.length < 10) { setError('Password must be at least 10 characters (with a letter and a number).'); return; }
    setBusy(true);
    try {
      if (isSignup) await store.signup(email.trim(), name.trim(), password);
      else await store.login(email.trim(), password);
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Something went wrong. Please try again.');
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
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>Live Classes</div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--sw-ink-900)' }}>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--sw-stone-600)' }}>
          {isSignup ? 'Sign up to join live classes.' : 'Sign in to join your live classes.'}
        </p>

        <form onSubmit={submit}>
          {isSignup && (
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="pname" style={label}>Name</label>
              <input id="pname" type="text" value={name} onChange={(e) => setName(e.target.value)} style={input} autoComplete="name" placeholder="Your name" />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="pemail" style={label}>Email</label>
            <input id="pemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} autoComplete="email" placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label htmlFor="ppass" style={label}>Password</label>
            <PasswordInput id="ppass" value={password} onChange={setPassword} style={input} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 10 characters' : '••••••••'} />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-error)', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="hov-forest-deep"
            style={{ width: '100%', height: 44, marginTop: 20, borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0 0', fontSize: 12.5, color: 'var(--sw-stone-600)', textAlign: 'center' }}>
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--sw-forest-700)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
