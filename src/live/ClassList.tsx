import { useEffect, useState } from 'react';
import { liveApi, LiveApiError, type JoinableClass, type JoinResult } from './liveApi';
import type { ParticipantStore } from './useParticipant';

const card = { background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px' } as const;

function StatusPill({ status }: { status: JoinableClass['status'] }) {
  const live = status === 'LIVE';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: live ? 'var(--sw-error)' : 'var(--sw-stone-600)', background: live ? 'var(--sw-error-bg)' : 'var(--sw-line-soft)', borderRadius: 999, padding: '3px 10px' }}>
      {live && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sw-error)' }} />}
      {live ? 'Live now' : 'Scheduled'}
    </span>
  );
}

export function ClassList({ store, onJoin, onBack }: { store: ParticipantStore; onJoin: (result: JoinResult, cls: JoinableClass) => void; onBack: () => void }) {
  const [classes, setClasses] = useState<JoinableClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setClasses(await liveApi.joinable());
    } catch (e) {
      setError(e instanceof LiveApiError ? e.message : 'Could not load classes.');
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000); // refresh so newly-started classes appear
    return () => clearInterval(t);
  }, []);

  async function join(cls: JoinableClass) {
    setJoining(cls.id);
    setError(null);
    try {
      const result = await liveApi.join(cls.slug);
      onJoin(result, cls);
    } catch (e) {
      setError(e instanceof LiveApiError ? e.message : 'Could not join the class.');
    } finally {
      setJoining(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sw-sand-050)', fontFamily: 'var(--font-body)' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: '#fff', borderBottom: '1px solid var(--sw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} title="Back" style={{ background: 'none', border: '1px solid var(--sw-line-soft)', borderRadius: 999, width: 32, height: 32, fontSize: 15, cursor: 'pointer', color: 'var(--sw-ink-900)' }}>←</button>
          <img src="/assets/shreevan-mark-on-forest.png" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>Masterclass</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{store.participant?.name}</span>
          <button onClick={store.logout} style={{ background: 'none', border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 48px' }}>
        <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, color: 'var(--sw-ink-900)' }}>
          Hello {store.participant?.name?.split(' ')[0]} 🌿
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Join a live class below. Live ones are joinable right now.</p>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--sw-error)', fontWeight: 600, marginBottom: 16 }}>{error}</div>
        )}

        {classes === null && <p style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading…</p>}
        {classes?.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: 'var(--sw-stone-600)', fontSize: 13.5 }}>
            No classes scheduled right now. Check back soon. ✨
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes?.map((c) => (
            <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>{c.title}</span>
                  <StatusPill status={c.status} />
                </div>
                {c.description && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
              </div>
              <button
                onClick={() => void join(c)}
                disabled={c.status !== 'LIVE' || joining === c.id}
                className={c.status === 'LIVE' ? 'hov-forest-deep' : undefined}
                style={{ flexShrink: 0, height: 38, padding: '0 20px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: c.status === 'LIVE' ? 'var(--sw-forest-900)' : 'var(--sw-line-soft)', color: c.status === 'LIVE' ? '#fff' : 'var(--sw-stone-600)', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, cursor: c.status === 'LIVE' ? 'pointer' : 'default', opacity: joining === c.id ? 0.6 : 1 }}>
                {joining === c.id ? 'Joining…' : c.status === 'LIVE' ? 'Join now' : 'Not started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
