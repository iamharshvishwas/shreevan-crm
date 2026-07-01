import { useEffect, useState } from 'react';
import { useParticipant } from './useParticipant';
import { ParticipantAuth } from './ParticipantAuth';
import { StudentHome } from './StudentHome';
import { ClassList } from './ClassList';
import { ClassRoom } from './ClassRoom';
import { isWaiting, liveApi, type JoinInfo, type JoinResult, type JoinableClass } from './liveApi';

interface ActiveRoom { info: JoinInfo; cls: JoinableClass }
interface WaitingState { slug: string; title: string; denied: boolean }
type View = 'home' | 'masterclass';

/** Remembers the room across a refresh so the student lands straight back in. */
const RESUME_KEY = 'sw_live_room';

/** Rebuild the list-card shape from a join response (used on refresh-resume). */
function clsFromJoin(info: JoinInfo, slug: string): JoinableClass {
  return { id: info.classId, title: info.title, slug, description: null, status: 'LIVE', mode: info.mode, scheduledAt: null, startedAt: null };
}

export function LiveApp() {
  const store = useParticipant();
  const [view, setView] = useState<View>('home');
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [waiting, setWaiting] = useState<WaitingState | null>(null);
  const [resuming, setResuming] = useState<boolean>(() => !!sessionStorage.getItem(RESUME_KEY));

  // Refresh mid-class → silently rejoin the same room (if it's still live).
  useEffect(() => {
    if (!store.participant) return;
    const slug = sessionStorage.getItem(RESUME_KEY);
    if (!slug) { setResuming(false); return; }
    let live = true;
    liveApi.join(slug)
      .then((r) => {
        if (!live) return;
        if (isWaiting(r)) { sessionStorage.removeItem(RESUME_KEY); return; }
        setRoom({ info: r, cls: clsFromJoin(r, slug) });
        setView('masterclass');
      })
      .catch(() => sessionStorage.removeItem(RESUME_KEY))
      .finally(() => { if (live) setResuming(false); });
    return () => { live = false; };
  }, [store.participant]);

  // Waiting room: poll the join endpoint until the host admits (or denies) us.
  useEffect(() => {
    if (!waiting || waiting.denied) return;
    let live = true;
    const tick = async () => {
      try {
        const r = await liveApi.join(waiting.slug);
        if (!live) return;
        if (!isWaiting(r)) {
          sessionStorage.setItem(RESUME_KEY, waiting.slug);
          setRoom({ info: r, cls: clsFromJoin(r, waiting.slug) });
          setWaiting(null);
        } else if (r.status === 'DENIED') {
          setWaiting((w) => (w ? { ...w, denied: true } : w));
        }
      } catch {
        if (live) setWaiting(null); // class ended while waiting → back to the list
      }
    };
    const t = setInterval(tick, 3000);
    return () => { live = false; clearInterval(t); };
  }, [waiting]);

  function handleJoinResult(result: JoinResult, cls: JoinableClass) {
    if (isWaiting(result)) {
      setWaiting({ slug: cls.slug, title: result.title, denied: result.status === 'DENIED' });
      return;
    }
    sessionStorage.setItem(RESUME_KEY, cls.slug);
    setRoom({ info: result, cls });
  }

  function leaveRoom() {
    sessionStorage.removeItem(RESUME_KEY);
    setRoom(null);
  }

  if (store.loading || resuming) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!store.participant) return <ParticipantAuth store={store} />;

  if (waiting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', fontFamily: 'var(--font-body)', padding: 24 }}>
        <div style={{ width: 400, maxWidth: '100%', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: '34px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{waiting.denied ? '🚫' : '🚪'}</div>
          <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, color: 'var(--sw-ink-900)' }}>
            {waiting.denied ? 'Request declined' : 'Waiting for the host to let you in…'}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>
            {waiting.denied
              ? `The host declined your request to join “${waiting.title}”.`
              : `You’ve asked to join “${waiting.title}”. Hang tight — this screen updates automatically.`}
          </p>
          {!waiting.denied && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 20 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-moss-600)', animation: `swPulse 1.2s ${i * 0.2}s infinite ease-in-out` }} />
              ))}
              <style>{'@keyframes swPulse { 0%,100% { opacity: 0.25 } 50% { opacity: 1 } }'}</style>
            </div>
          )}
          <button onClick={() => setWaiting(null)} className="hov-forest-deep"
            style={{ height: 42, padding: '0 24px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {waiting.denied ? 'Back to classes' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  if (room) {
    return (
      <ClassRoom
        info={room.info}
        cls={room.cls}
        userName={store.participant.name}
        onLeave={leaveRoom}
      />
    );
  }

  if (view === 'masterclass') {
    return <ClassList store={store} onBack={() => setView('home')} onJoin={handleJoinResult} />;
  }

  return <StudentHome store={store} onOpenMasterclass={() => setView('masterclass')} />;
}
