import { useEffect, useState } from 'react';
import { useInstructor } from './useInstructor';
import { InstructorAuth } from './InstructorAuth';
import { InstructorClasses } from './InstructorClasses';
import { HostRoom } from './HostRoom';
import { teachApi, type HostRoomInfo } from './teachApi';

/** Remembers the hosted room across a refresh so the host lands straight back in. */
const RESUME_KEY = 'sw_teach_room';

export function TeachApp() {
  const store = useInstructor();
  const [room, setRoom] = useState<HostRoomInfo | null>(null);
  const [resuming, setResuming] = useState<boolean>(() => !!sessionStorage.getItem(RESUME_KEY));

  // Refresh mid-class → silently rejoin as host (if the class is still live).
  useEffect(() => {
    if (!store.instructor) return;
    const classId = sessionStorage.getItem(RESUME_KEY);
    if (!classId) { setResuming(false); return; }
    let live = true;
    teachApi.hostToken(classId)
      .then((info) => { if (live) setRoom(info); })
      .catch(() => sessionStorage.removeItem(RESUME_KEY))
      .finally(() => { if (live) setResuming(false); });
    return () => { live = false; };
  }, [store.instructor]);

  function enterRoom(info: HostRoomInfo) {
    sessionStorage.setItem(RESUME_KEY, info.classId);
    setRoom(info);
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

  if (!store.instructor) return <InstructorAuth store={store} />;

  if (room) {
    return <HostRoom info={room} hostName={store.instructor.name} onLeave={leaveRoom} />;
  }

  return <InstructorClasses store={store} onEnterRoom={enterRoom} />;
}
