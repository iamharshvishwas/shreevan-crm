import { useState } from 'react';
import { useParticipant } from './useParticipant';
import { ParticipantAuth } from './ParticipantAuth';
import { ClassList } from './ClassList';
import { ClassRoom } from './ClassRoom';
import type { JoinInfo, JoinableClass } from './liveApi';

interface ActiveRoom { info: JoinInfo; cls: JoinableClass }

export function LiveApp() {
  const store = useParticipant();
  const [room, setRoom] = useState<ActiveRoom | null>(null);

  if (store.loading) {
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
        onLeave={() => setRoom(null)}
      />
    );
  }

  return <ClassList store={store} onJoin={(info, cls) => setRoom({ info, cls })} />;
}
