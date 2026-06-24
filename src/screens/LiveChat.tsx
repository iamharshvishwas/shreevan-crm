import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppStore } from '../store';
import { liveChatApi, type ChatConversationSummary, type ChatThread } from '../api/chat';

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function LiveChat({ app }: { app: AppStore }) {
  const [convos, setConvos] = useState<ChatConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async () => {
    try {
      const list = await liveChatApi.list();
      // Needs-attention first, then most recent.
      list.sort((a, b) =>
        Number(b.needsAttention) - Number(a.needsAttention) ||
        new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
      setConvos(list);
      setError(null);
    } catch {
      setError('Could not load conversations. Is the backend running?');
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const t = await liveChatApi.thread(id);
      setThread(t);
    } catch {
      // ignore transient poll errors
    }
  }, []);

  // Poll the list every 4s.
  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), 4000);
    return () => clearInterval(t);
  }, [loadList]);

  // Poll the open thread every 3s.
  useEffect(() => {
    if (!selectedId) return;
    void loadThread(selectedId);
    const t = setInterval(() => void loadThread(selectedId), 3000);
    return () => clearInterval(t);
  }, [selectedId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  async function takeOver(toHuman: boolean) {
    if (!selectedId) return;
    try {
      await liveChatApi.handover(selectedId, toHuman);
      await loadThread(selectedId);
      await loadList();
      app.showToastMsg(toHuman ? 'You’ve taken over — Veda paused for this chat' : 'Handed back to Veda');
    } catch {
      app.showToastMsg('Could not update');
    }
  }

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    const text = replyText.trim();
    setReplyText('');
    try {
      await liveChatApi.reply(selectedId, text);
      await loadThread(selectedId);
      await loadList();
    } catch {
      app.showToastMsg('Could not send');
      setReplyText(text);
    }
  }

  const attentionCount = convos.filter((c) => c.needsAttention).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: 'var(--sw-ink-900)' }}>Live Chat</h1>
        <span style={{ fontSize: 12.5, color: 'var(--sw-ink-400)' }}>Website conversations — Veda live, you supervise</span>
        {attentionCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '3px 10px', borderRadius: 999 }}>
            🚩 {attentionCount} need attention
          </span>
        )}
      </div>

      {error && <div style={{ fontSize: 13, color: '#b45309', background: '#fef3c7', padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0, paddingBottom: 20 }}>
        {/* Conversation list */}
        <div style={{ width: 320, flexShrink: 0, background: '#fff', border: '1px solid var(--sw-sand-200)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto' }}>
            {loaded && convos.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--sw-ink-400)', fontSize: 13.5 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>💬</div>
                No website chats yet. They’ll appear here live.
              </div>
            )}
            {convos.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setThread(null); }}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--sw-sand-100)',
                    background: active ? 'var(--sw-sand-050)' : '#fff',
                    borderLeft: c.needsAttention ? '3px solid #dc2626' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--sw-ink-900)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.visitor}</span>
                    <span style={{ fontSize: 11, color: 'var(--sw-ink-400)' }}>{relTime(c.lastAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sw-ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {c.lastDirection === 'OUTBOUND' ? '↩ ' : ''}{c.lastMessage}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                    <Tag bg={c.handoverToHuman ? '#dbeafe' : '#dcfce7'} fg={c.handoverToHuman ? '#1d4ed8' : '#15803d'}>
                      {c.handoverToHuman ? 'You' : 'Veda'}
                    </Tag>
                    {c.needsAttention && <Tag bg="#fee2e2" fg="#b91c1c">🚩 {c.attentionReason ?? 'Needs attention'}</Tag>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid var(--sw-sand-200)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
          {!thread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sw-ink-400)', fontSize: 14 }}>
              {selectedId ? 'Loading…' : 'Select a conversation to view it live.'}
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--sw-sand-100)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sw-ink-900)' }}>{thread.visitor}</div>
                  <div style={{ fontSize: 12, color: 'var(--sw-ink-400)' }}>{thread.country ?? 'Website visitor'} · {thread.handoverToHuman ? 'You are handling' : 'Veda is handling'}</div>
                  {(thread.email || thread.phone) && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--sw-ink-600)', flexWrap: 'wrap' }}>
                      {thread.email && <span title="Email">✉️ {thread.email}</span>}
                      {thread.phone && (
                        <a href={`https://wa.me/${thread.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" title="Open in WhatsApp" style={{ color: '#15803d', textDecoration: 'none', fontWeight: 600 }}>
                          📱 {thread.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {thread.handoverToHuman ? (
                    <button onClick={() => takeOver(false)} style={btn('#fff', 'var(--sw-forest-800)', 'var(--sw-sand-200)')}>↩ Hand back to Veda</button>
                  ) : (
                    <button onClick={() => takeOver(true)} style={btn('var(--sw-forest-700)', '#fff')}>Take over chat</button>
                  )}
                </div>
              </div>

              {thread.needsAttention && (
                <div style={{ padding: '8px 18px', background: '#fef2f2', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>
                  🚩 {thread.attentionReason ?? 'This chat may need a human.'}
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--sw-sand-050)' }}>
                {thread.messages.map((m) => {
                  const out = m.direction === 'OUTBOUND';
                  return (
                    <div key={m.id} style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      <div style={{
                        padding: '8px 12px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                        background: out ? 'var(--sw-forest-700)' : '#fff',
                        color: out ? '#fff' : 'var(--sw-ink-900)',
                        border: out ? 'none' : '1px solid var(--sw-sand-200)',
                        borderBottomRightRadius: out ? 4 : 12, borderBottomLeftRadius: out ? 12 : 4,
                      }}>{m.body}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--sw-ink-400)', marginTop: 2, textAlign: out ? 'right' : 'left' }}>
                        {out ? m.authorName : thread.visitor} · {relTime(m.occurredAt)}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <form onSubmit={(e) => { e.preventDefault(); void sendReply(); }} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--sw-sand-100)' }}>
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={thread.handoverToHuman ? 'Type your reply…' : 'Type to take over and reply…'}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--sw-sand-200)', fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none' }}
                />
                <button type="submit" style={btn('var(--sw-forest-900)', '#fff')}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: bg, color: fg }}>{children}</span>;
}

function btn(bg: string, fg: string, border?: string): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
    fontFamily: 'var(--font-body)', background: bg, color: fg,
    border: border ? `1px solid ${border}` : 'none',
  };
}
