import { useMemo, useState } from 'react';
import { VideoRoom } from './VideoRoom';
import { ChatPanel } from './ChatPanel';
import { PollPanel } from './PollPanel';
import { ClassEndedOverlay } from './ClassEndedOverlay';
import { useClassEnded } from './useClassEnded';
import { useIsNarrow } from './useIsNarrow';
import { liveApi, type JoinInfo, type JoinableClass } from './liveApi';
import type { ChatApi, PollApi } from './roomTypes';

type Tab = 'chat' | 'poll';

export function ClassRoom({ info, cls, userName, onLeave }: { info: JoinInfo; cls: JoinableClass; userName: string; onLeave: () => void }) {
  const [tab, setTab] = useState<Tab>('chat');
  const narrow = useIsNarrow();
  const ended = useClassEnded(info.classId, liveApi.getStatus);
  const chatApi: ChatApi = useMemo(() => ({
    list: () => liveApi.listMessages(info.classId),
    send: (b) => liveApi.postMessage(info.classId, b),
  }), [info.classId]);
  const pollApi: PollApi = useMemo(() => ({
    get: () => liveApi.getPoll(info.classId),
    vote: (o) => liveApi.vote(info.classId, o),
  }), [info.classId]);

  const tabBtn = (key: Tab, label: string) => (
    <button onClick={() => setTab(key)}
      style={{ flex: 1, height: 40, border: 'none', borderBottom: tab === key ? '2px solid var(--sw-forest-900)' : '2px solid transparent', background: 'none', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, color: tab === key ? 'var(--sw-ink-900)' : 'var(--sw-stone-600)', cursor: 'pointer' }}>
      {label}
    </button>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--sw-forest-950)', fontFamily: 'var(--font-body)' }}>
      {ended && <ClassEndedOverlay onLeave={onLeave} />}

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-error)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>{cls.title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Live</span>
        </div>
        <button onClick={onLeave} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 999, padding: '6px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          ← Back to classes
        </button>
      </div>

      {/* body: video + side panel (stacks vertically on phones) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 14, padding: '0 14px 14px', minHeight: 0 }}>
        <VideoRoom room={{ videoEnabled: info.videoEnabled, token: info.token }} roles={info.roles} userName={userName} onLeave={onLeave} />

        <aside style={{ width: narrow ? 'auto' : 320, height: narrow ? 280 : 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--sw-line-soft)' }}>
            {tabBtn('chat', '💬 Chat')}
            {tabBtn('poll', '📊 Poll')}
          </div>
          {tab === 'chat' ? <ChatPanel api={chatApi} /> : <PollPanel api={pollApi} isHost={false} />}
        </aside>
      </div>
    </div>
  );
}
