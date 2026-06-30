import { useState } from 'react';
import { useInstructor } from './useInstructor';
import { InstructorAuth } from './InstructorAuth';
import { InstructorClasses } from './InstructorClasses';
import { HostRoom } from './HostRoom';
import type { HostRoomInfo } from './teachApi';

export function TeachApp() {
  const store = useInstructor();
  const [room, setRoom] = useState<HostRoomInfo | null>(null);

  if (store.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!store.instructor) return <InstructorAuth store={store} />;

  if (room) {
    return <HostRoom info={room} hostName={store.instructor.name} onLeave={() => setRoom(null)} />;
  }

  return <InstructorClasses store={store} onEnterRoom={setRoom} />;
}
