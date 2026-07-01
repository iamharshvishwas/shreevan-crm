import { useEffect, useState, type ReactNode } from 'react';
import type { PollApi, PollView } from './roomTypes';

function Results({ poll }: { poll: PollView }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {poll.options.map((o) => {
        const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
        const mine = poll.myOptionId === o.id;
        return (
          <div key={o.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3, color: 'var(--sw-ink-900)' }}>
              <span style={{ fontWeight: mine ? 700 : 500 }}>{o.text}{mine ? ' ✓' : ''}</span>
              <span style={{ color: 'var(--sw-stone-600)' }}>{pct}% · {o.votes}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--sw-line-soft)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: mine ? 'var(--sw-forest-700)' : 'var(--sw-moss-600)', transition: 'width 240ms' }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)' }}>{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}{poll.isOpen ? '' : ' · closed'}</div>
    </div>
  );
}

function CreatePoll({ onCreate }: { onCreate: (q: string, opts: string[]) => Promise<void> }) {
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 2) { setErr('Add a question.'); return; }
    if (clean.length < 2) { setErr('Add at least two options.'); return; }
    setBusy(true); setErr(null);
    try { await onCreate(question.trim(), clean); setQuestion(''); setOpts(['', '']); }
    catch (e) { setErr((e as Error).message || 'Could not start the poll.'); }
    finally { setBusy(false); }
  }

  const inp = { width: '100%', height: 36, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13, background: '#fff' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Poll question" style={inp} />
      {opts.map((o, i) => (
        <input key={i} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} style={inp} />
      ))}
      {opts.length < 6 && (
        <button onClick={() => setOpts([...opts, ''])} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--sw-forest-700)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>+ Add option</button>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--sw-error)', fontWeight: 600 }}>{err}</div>}
      <button onClick={() => void submit()} disabled={busy} className="hov-forest-deep"
        style={{ height: 36, borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Starting…' : 'Launch poll'}
      </button>
    </div>
  );
}

export function PollPanel({ api, isHost }: { api: PollApi; isHost: boolean }) {
  const [poll, setPoll] = useState<PollView | null | undefined>(undefined); // undefined = loading
  const [voting, setVoting] = useState(false);
  const [newPoll, setNewPoll] = useState(false); // host: show the create form

  useEffect(() => {
    let live = true;
    const tick = async () => { try { const p = await api.get(); if (live) setPoll(p); } catch { /* keep */ } };
    void tick();
    const t = setInterval(tick, 3000);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function vote(optionId: string) {
    if (!api.vote || voting) return;
    setVoting(true);
    try { setPoll(await api.vote(optionId) as PollView); }
    catch { /* ignore */ }
    finally { setVoting(false); }
  }

  const wrap = (children: ReactNode) => <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>;

  if (poll === undefined) return wrap(<div style={{ margin: 'auto', color: 'var(--sw-stone-600)', fontSize: 12.5 }}>Loading…</div>);

  // Host: launching a new poll (no poll yet, or explicitly creating another)
  if (isHost && (newPoll || poll === null || !poll.isOpen)) {
    return wrap(
      <>
        {poll && !poll.isOpen && !newPoll ? (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--sw-ink-900)' }}>{poll.question}</div>
            <Results poll={poll} />
            <button onClick={() => setNewPoll(true)} className="hov-forest-deep" style={{ height: 36, borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>New poll</button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--sw-ink-900)' }}>Launch a poll</div>
            <CreatePoll onCreate={async (q, o) => { await api.create!(q, o); setNewPoll(false); setPoll(await api.get()); }} />
            {poll && <button onClick={() => setNewPoll(false)} style={{ background: 'none', border: 'none', color: 'var(--sw-stone-600)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
          </>
        )}
      </>,
    );
  }

  // No poll yet (learner view)
  if (poll === null) {
    return wrap(<div style={{ margin: 'auto', textAlign: 'center', color: 'var(--sw-stone-600)', fontSize: 12.5 }}>No poll yet. The host will start one. 📊</div>);
  }

  // Learner: open poll, not yet voted → show options to pick
  const canVote = !isHost && poll.isOpen && !poll.myOptionId && api.vote;
  return wrap(
    <>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--sw-ink-900)' }}>{poll.question}</div>
      {canVote ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {poll.options.map((o) => (
            <button key={o.id} onClick={() => void vote(o.id)} disabled={voting}
              style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--sw-line-soft)', background: '#fff', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)', cursor: voting ? 'default' : 'pointer' }}>
              {o.text}
            </button>
          ))}
        </div>
      ) : (
        <Results poll={poll} />
      )}
      {isHost && poll.isOpen && (
        <button onClick={() => void api.close?.()} style={{ height: 34, borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: 'var(--sw-ink-900)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Close poll</button>
      )}
    </>,
  );
}
