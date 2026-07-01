import { useEffect, useMemo, useState } from 'react';
import { VideoRoom } from '../live/VideoRoom';
import { ChatPanel } from '../live/ChatPanel';
import { PollPanel } from '../live/PollPanel';
import { PeoplePanel } from '../live/PeoplePanel';
import { ClassEndedOverlay } from '../live/ClassEndedOverlay';
import { useClassEnded } from '../live/useClassEnded';
import { useIsNarrow } from '../live/useIsNarrow';
import type { ChatApi, PollApi } from '../live/roomTypes';
import { teachApi, TeachApiError, type HostRoomInfo, type JoinRequest } from './teachApi';

type Tab = 'chat' | 'poll' | 'people';

export function HostRoom({ info, hostName, onLeave }: { info: HostRoomInfo; hostName: string; onLeave: () => void }) {
  const [tab, setTab] = useState<Tab>('chat');
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const narrow = useIsNarrow();
  // Covers the edge case of ending the class from another tab/session.
  const ended = useClassEnded(info.classId, teachApi.getStatus);
  const [pending, setPending] = useState<JoinRequest[]>([]);

  // Waiting room: poll pending join requests while hosting an approval class.
  useEffect(() => {
    if (!info.requireApproval) return;
    let live = true;
    const tick = async () => {
      try { const rows = await teachApi.joinRequests(info.classId); if (live) setPending(rows); }
      catch { /* transient — next poll recovers */ }
    };
    void tick();
    const t = setInterval(tick, 4000);
    return () => { live = false; clearInterval(t); };
  }, [info.classId, info.requireApproval]);

  async function decide(reqId: string, approve: boolean) {
    setPending((p) => p.filter((r) => r.id !== reqId)); // optimistic
    try { await (approve ? teachApi.approveJoin(info.classId, reqId) : teachApi.denyJoin(info.classId, reqId)); }
    catch { /* next poll restores if it failed */ }
  }

  /** End the class for everyone — confirmation guards against an accidental click. */
  async function endClass() {
    if (!window.confirm(`End "${info.title}" for everyone? Participants will be notified that the class is over.`)) return;
    setEndBusy(true);
    setEndError(null);
    try {
      await teachApi.end(info.classId);
      onLeave(); // leaves the room; participants see the "class has ended" popup
    } catch (e) {
      setEndError(e instanceof TeachApiError ? e.message : 'Could not end the class — try again.');
      setEndBusy(false);
    }
  }
  const chatApi: ChatApi = useMemo(() => ({
    list: () => teachApi.listMessages(info.classId),
    send: (b) => teachApi.postMessage(info.classId, b),
  }), [info.classId]);
  const pollApi: PollApi = useMemo(() => ({
    get: () => teachApi.getPoll(info.classId),
    create: (q, o) => teachApi.createPoll(info.classId, q, o),
    close: () => teachApi.closePoll(info.classId),
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-error)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16 }}>{info.title}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Hosting · Live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {endError && <span style={{ fontSize: 12, color: '#f2b8b5', fontWeight: 600 }}>{endError}</span>}
          <button onClick={() => void endClass()} disabled={endBusy}
            style={{ background: '#b5443a', border: '1px solid #b5443a', color: '#fff', borderRadius: 999, padding: '6px 16px', fontSize: 12.5, fontWeight: 700, cursor: endBusy ? 'default' : 'pointer', opacity: endBusy ? 0.6 : 1 }}>
            {endBusy ? 'Ending…' : '⏹ End class'}
          </button>
          <button onClick={onLeave} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 999, padding: '6px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            ← Back to my classes
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 14px 10px', background: 'rgba(212,163,74,0.15)', border: '1px solid rgba(212,163,74,0.4)', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#f0d9a8' }}>🚪 {pending.length} waiting to join:</span>
          {pending.slice(0, 6).map((r) => (
            <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: '3px 5px 3px 12px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{r.name}</span>
              <button onClick={() => void decide(r.id, true)}
                style={{ height: 24, padding: '0 10px', borderRadius: 999, border: 'none', background: 'var(--sw-moss-600)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>✓ Admit</button>
              <button onClick={() => void decide(r.id, false)}
                style={{ height: 24, padding: '0 10px', borderRadius: 999, border: 'none', background: '#b5443a', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 14, padding: '0 14px 14px', minHeight: 0 }}>
        <VideoRoom room={{ videoEnabled: info.videoEnabled, token: info.token }} roles={info.roles} userName={hostName} onLeave={onLeave} />
        <aside style={{ width: narrow ? 'auto' : 320, height: narrow ? 280 : 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--sw-line-soft)' }}>
            {tabBtn('chat', '💬 Chat')}
            {tabBtn('poll', '📊 Poll')}
            {tabBtn('people', '👥 People')}
          </div>
          {tab === 'chat' ? <ChatPanel api={chatApi} /> : tab === 'poll' ? <PollPanel api={pollApi} isHost /> : <PeoplePanel roles={info.roles} isHost />}
        </aside>
      </div>
    </div>
  );
}
