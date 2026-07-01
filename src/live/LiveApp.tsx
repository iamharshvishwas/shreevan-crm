import { useEffect, useState } from 'react';
import { useParticipant } from './useParticipant';
import { ParticipantAuth } from './ParticipantAuth';
import { StudentHome } from './StudentHome';
import { ClassList } from './ClassList';
import { ClassRoom } from './ClassRoom';
import { liveApi, type JoinInfo, type JoinableClass } from './liveApi';

interface ActiveRoom { info: JoinInfo; cls: JoinableClass }
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
  const [resuming, setResuming] = useState<boolean>(() => !!sessionStorage.getItem(RESUME_KEY));

  // Refresh mid-class → silently rejoin the same room (if it's still live).
  useEffect(() => {
    if (!store.participant) return;
    const slug = sessionStorage.getItem(RESUME_KEY);
    if (!slug) { setResuming(false); return; }
    let live = true;
    liveApi.join(slug)
      .then((info) => { if (live) { setRoom({ info, cls: clsFromJoin(info, slug) }); setView('masterclass'); } })
      .catch(() => sessionStorage.removeItem(RESUME_KEY))
      .finally(() => { if (live) setResuming(false); });
    return () => { live = false; };
  }, [store.participant]);

  function enterRoom(info: JoinInfo, cls: JoinableClass) {
    sessionStorage.setItem(RESUME_KEY, cls.slug);
    setRoom({ info, cls });
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
    return <ClassList store={store} onBack={() => setView('home')} onJoin={enterRoom} />;
  }

  return <StudentHome store={store} onOpenMasterclass={() => setView('masterclass')} />;
}
