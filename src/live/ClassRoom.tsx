import { useState } from 'react';
import { VideoRoom } from './VideoRoom';
import type { JoinInfo, JoinableClass } from './liveApi';

type Tab = 'chat' | 'poll';

function EmptyPanel({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', color: 'var(--sw-stone-600)', padding: 24 }}>
      <div style={{ fontSize: 30 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--sw-ink-900)' }}>{title}</div>
      <div style={{ fontSize: 12.5, maxWidth: 240 }}>{note}</div>
    </div>
  );
}

export function ClassRoom({ info, cls, userName, onLeave }: { info: JoinInfo; cls: JoinableClass; userName: string; onLeave: () => void }) {
  const [tab, setTab] = useState<Tab>('chat');

  const tabBtn = (key: Tab, label: string) => (
    <button onClick={() => setTab(key)}
      style={{ flex: 1, height: 40, border: 'none', borderBottom: tab === key ? '2px solid var(--sw-forest-900)' : '2px solid transparent', background: 'none', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, color: tab === key ? 'var(--sw-ink-900)' : 'var(--sw-stone-600)', cursor: 'pointer' }}>
      {label}
    </button>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--sw-forest-950)', fontFamily: 'var(--font-body)' }}>
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

      {/* body: video + side panel */}
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '0 14px 14px', minHeight: 0 }}>
        <VideoRoom info={info} userName={userName} onLeave={onLeave} />

        <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--sw-line-soft)' }}>
            {tabBtn('chat', '💬 Chat')}
            {tabBtn('poll', '📊 Poll')}
          </div>
          {tab === 'chat'
            ? <EmptyPanel icon="💬" title="Live chat" note="Two-way chat with the class goes live in the next update — the panel is ready." />
            : <EmptyPanel icon="📊" title="Live polls" note="The host will be able to run polls here, with live results, in the next update." />}
        </aside>
      </div>
    </div>
  );
}
