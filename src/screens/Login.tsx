import { FormEvent, useState } from 'react';
import type { AuthStore } from '../auth/useAuth';
import { ApiError } from '../api/client';
import { PasswordInput } from '../components/ui';

const inputStyle = {
  width: '100%',
  height: 44,
  border: '1px solid var(--sw-line-soft)',
  borderRadius: 8,
  padding: '0 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--sw-ink-900)',
  background: '#ffffff',
} as const;

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--sw-ink-900)',
  marginBottom: 6,
} as const;

export function Login({ auth }: { auth: AuthStore }) {
  const [email, setEmail] = useState(import.meta.env.DEV ? 'harsh@shreevanwellness.com' : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 2FA second step: once the password is accepted we hold the challenge token
  // and collect the authenticator code.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  function toApiError(err: unknown): string {
    if (err instanceof ApiError) {
      return err.status === 0 ? 'Could not reach the API. Make sure the backend is running on port 3000.' : err.message;
    }
    return 'Something went wrong. Please try again.';
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const outcome = await auth.login(email.trim(), password);
      if (outcome.status === '2fa') {
        setChallengeToken(outcome.challengeToken);
        setCode('');
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setBusy(true);
    try {
      await auth.verify2fa(challengeToken, code.replace(/\s/g, ''));
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function backToPassword() {
    setChallengeToken(null);
    setCode('');
    setError(null);
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sw-forest-900)',
        fontFamily: 'var(--font-body)',
        padding: 24,
      }}
    >
      <div
        className="sw-screen"
        style={{
          width: 400,
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: '34px 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <img src="/assets/shreevan-mark-on-forest.png" alt="" style={{ width: 44, height: 44, borderRadius: 11 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>
              Shreevan Wellness
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>
              CRM · Lead tracker
            </div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 22, color: 'var(--sw-ink-900)' }}>
          {challengeToken ? 'Enter your code' : 'Sign in'}
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--sw-stone-600)' }}>
          {challengeToken
            ? 'Open your authenticator app and enter the 6-digit code (or a backup code).'
            : 'Use your team account to access the CRM.'}
        </p>

        {!challengeToken && auth.sessionExpired && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-warning)', fontWeight: 600, marginBottom: 16, background: 'var(--sw-warning-bg)', border: '1px solid #e3d3a8', borderRadius: 8, padding: '10px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-warning)', flexShrink: 0 }} />
            Your session expired — please sign in again.
          </div>
        )}

        {!challengeToken ? (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoComplete="username" />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <PasswordInput id="password" value={password} onChange={setPassword} placeholder="••••••••" style={inputStyle} autoComplete="current-password" />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-error)', flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="hov-forest-deep"
              style={{
                width: '100%',
                height: 44,
                marginTop: 20,
                borderRadius: 999,
                border: '1px solid var(--sw-forest-900)',
                background: 'var(--sw-forest-900)',
                color: '#ffffff',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <div style={{ marginBottom: 6 }}>
              <label htmlFor="code" style={labelStyle}>Authentication code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                style={{ ...inputStyle, letterSpacing: '0.3em', textAlign: 'center', fontSize: 18 }}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sw-error)', fontWeight: 600, marginTop: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-error)', flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || code.replace(/\s/g, '').length < 6}
              className="hov-forest-deep"
              style={{
                width: '100%',
                height: 44,
                marginTop: 20,
                borderRadius: 999,
                border: '1px solid var(--sw-forest-900)',
                background: 'var(--sw-forest-900)',
                color: '#ffffff',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy || code.replace(/\s/g, '').length < 6 ? 0.7 : 1,
              }}
            >
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>

            <button
              type="button"
              onClick={backToPassword}
              style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--sw-stone-600)', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back to sign in
            </button>
          </form>
        )}

        {!challengeToken && import.meta.env.DEV && (
          <p style={{ margin: '18px 0 0 0', fontSize: 11.5, color: 'var(--sw-stone-600)', textAlign: 'center', lineHeight: 1.5 }}>
            Dev: harsh@shreevanwellness.com / changeme123
          </p>
        )}
      </div>
    </div>
  );
}
