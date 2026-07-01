import { useEffect, useState } from 'react';
import { teachApi, TeachApiError, type HostClass, type HostRoomInfo } from './teachApi';
import type { ClassMode } from '../live/roomTypes';
import type { InstructorStore } from './useInstructor';

const card = { background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', padding: '18px 20px' } as const;
const input = { width: '100%', height: 40, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13.5, background: '#fff' } as const;

function StatusPill({ status }: { status: HostClass['status'] }) {
  const map = { LIVE: ['Live', 'var(--sw-error)', 'var(--sw-error-bg)'], SCHEDULED: ['Scheduled', 'var(--sw-stone-600)', 'var(--sw-line-soft)'], ENDED: ['Ended', 'var(--sw-stone-600)', 'var(--sw-line-soft)'] } as const;
  const [label, color, bg] = map[status];
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color, background: bg, borderRadius: 999, padding: '3px 10px' }}>{label}</span>;
}

export function InstructorClasses({ store, onEnterRoom }: { store: InstructorStore; onEnterRoom: (info: HostRoomInfo) => void }) {
  const [classes, setClasses] = useState<HostClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<ClassMode>('WEBINAR');
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    try { setClasses(await teachApi.myClasses()); }
    catch (e) { setError(e instanceof TeachApiError ? e.message : 'Could not load classes.'); }
  }
  useEffect(() => { void load(); }, []);

  async function act(fn: () => Promise<unknown>, id: string) {
    setBusyId(id); setError(null);
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof TeachApiError ? e.message : 'Action failed.'); }
    finally { setBusyId(null); }
  }

  async function create() {
    if (title.trim().length < 2) { setError('Give the class a title.'); return; }
    setCreating(true); setError(null);
    try {
      await teachApi.create(title.trim(), description.trim() || undefined, mode);
      setTitle(''); setDescription('');
      await load();
    } catch (e) { setError(e instanceof TeachApiError ? e.message : 'Could not create the class.'); }
    finally { setCreating(false); }
  }

  async function joinAsHost(c: HostClass) {
    setBusyId(c.id); setError(null);
    try { onEnterRoom(await teachApi.hostToken(c.id)); }
    catch (e) { setError(e instanceof TeachApiError ? e.message : 'Could not open the room.'); }
    finally { setBusyId(null); }
  }

  const btn = (label: string, onClick: () => void, kind: 'primary' | 'ghost' = 'ghost', disabled = false) => (
    <button onClick={onClick} disabled={disabled}
      className={kind === 'primary' ? 'hov-forest-deep' : undefined}
      style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: kind === 'primary' ? 'var(--sw-forest-900)' : '#fff', color: kind === 'primary' ? '#fff' : 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sw-sand-050)', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: '#fff', borderBottom: '1px solid var(--sw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/shreevan-mark-on-forest.png" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>Instructor · My Classes</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{store.instructor?.name}</span>
          <button onClick={store.logout} style={{ background: 'none', border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 48px' }}>
        {/* create */}
        <section style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>New class</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class title — e.g. cloud101" style={input} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" style={input} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginBottom: 6 }}>Class type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  ['WEBINAR', '📢 Webinar', 'Students watch. Raise hand → you allow to speak. Best for big classes.'],
                  ['MEETING', '👥 Meeting', 'Everyone can turn on their own mic & camera. Best for small groups.'],
                ] as const).map(([m, label, desc]) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${mode === m ? 'var(--sw-forest-900)' : 'var(--sw-line-soft)'}`,
                      background: mode === m ? 'rgba(23,61,50,0.05)' : '#fff' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--sw-ink-900)' }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 2, lineHeight: 1.35 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {btn(creating ? 'Creating…' : 'Create class', () => void create(), 'primary', creating)}
            </div>
          </div>
        </section>

        {error && <div style={{ fontSize: 13, color: 'var(--sw-error)', fontWeight: 600, marginBottom: 16 }}>{error}</div>}

        {classes === null && <p style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading…</p>}
        {classes?.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'var(--sw-stone-600)', fontSize: 13.5 }}>No classes yet. Create your first one above. 🌿</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes?.map((c) => (
            <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>{c.title}</span>
                  <StatusPill status={c.status} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--sw-stone-600)', border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '2px 8px' }}>{c.mode === 'MEETING' ? '👥 Meeting' : '📢 Webinar'}</span>
                </div>
                {c.description && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {c.status === 'SCHEDULED' && btn(busyId === c.id ? '…' : 'Start', () => void act(() => teachApi.start(c.id), c.id), 'primary', busyId === c.id)}
                {c.status === 'LIVE' && btn(busyId === c.id ? '…' : 'Join as host', () => void joinAsHost(c), 'primary', busyId === c.id)}
                {c.status === 'LIVE' && btn('End', () => void act(() => teachApi.end(c.id), c.id), 'ghost', busyId === c.id)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
