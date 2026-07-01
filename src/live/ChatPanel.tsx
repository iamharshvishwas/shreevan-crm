import { useEffect, useRef, useState } from 'react';
import type { ChatApi, ChatMessage } from './roomTypes';

export function ChatPanel({ api }: { api: ChatApi }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  useEffect(() => {
    let live = true;
    const tick = async () => { try { const m = await api.list(); if (live) setMsgs(m); } catch { /* keep last */ } };
    void tick();
    const t = setInterval(tick, 2000);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function onScroll() {
    const el = scroller.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function submit() {
    const b = text.trim();
    if (!b || sending) return;
    setSending(true);
    nearBottom.current = true;
    try {
      await api.send(b);
      setText('');
      setMsgs(await api.list());
    } catch { /* ignore; next poll recovers */ }
    finally { setSending(false); }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={scroller} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--sw-stone-600)', fontSize: 12.5 }}>No messages yet. Say hello 👋</div>
        )}
        {msgs.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.isHost ? 'var(--sw-forest-700)' : 'var(--sw-ink-900)' }}>{m.authorName}</span>
              {m.isHost && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff', background: 'var(--sw-forest-700)', borderRadius: 999, padding: '1px 6px' }}>Host</span>}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--sw-ink-900)', lineHeight: 1.45, wordBreak: 'break-word' }}>{m.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--sw-line-soft)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="Type a message…"
          maxLength={1000}
          style={{ flex: 1, height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13.5, background: '#fff' }}
        />
        <button onClick={() => void submit()} disabled={sending || !text.trim()} className="hov-forest-deep"
          style={{ height: 38, padding: '0 16px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: sending || !text.trim() ? 'default' : 'pointer', opacity: sending || !text.trim() ? 0.55 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}
