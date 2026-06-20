import { useEffect, useRef, useState } from 'react';
import { vedaApi } from '../api/veda';

// ---- Minimal Web Speech API typings (not in lib.dom for all TS configs) ----
interface SpeechRecognitionEvent { results: { 0: { 0: { transcript: string } } }; }
interface ISpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Phase = 'idle' | 'listening' | 'thinking' | 'replied';

export function VedaMic() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const speechSupported = getRecognitionCtor() !== null;

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // synthesis not available — silent
    }
  }

  async function send(text: string) {
    if (!text.trim()) return;
    setTranscript(text);
    setPhase('thinking');
    setReply('');
    setActions([]);
    try {
      const res = await vedaApi.command(text);
      setReply(res.reply);
      setActions(res.actions);
      setPhase('replied');
      speak(res.reply);
    } catch {
      setReply('Could not reach Veda. Make sure the backend is running and OpenAI is configured.');
      setPhase('replied');
    }
  }

  function startListening() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      void send(text);
    };
    rec.onerror = () => setPhase('idle');
    rec.onend = () => setPhase((p) => (p === 'listening' ? 'idle' : p));
    recognitionRef.current = rec;
    setTranscript('');
    setReply('');
    setPhase('listening');
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setPhase('idle');
  }

  const accent = 'var(--sw-forest-700)';

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Ask Veda"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--sw-forest-900)', color: '#fff',
          boxShadow: '0 6px 20px rgba(23,61,50,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 160ms',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10" />
          <path d="M12 6v6l4 2" />
          <path d="M20 2v4h4" />
          <path d="M22 2 17 7" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 1000,
          width: 360, maxWidth: 'calc(100vw - 48px)',
          background: '#fff', borderRadius: 16, border: '1px solid var(--sw-sand-200)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}>
          {/* Header */}
          <div style={{ background: 'var(--sw-forest-900)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: '#fff' }}>Veda</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Voice assistant</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 2 }}>
              {(['en-IN', 'hi-IN'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 6, padding: '3px 9px',
                    fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)',
                    background: lang === l ? '#fff' : 'transparent',
                    color: lang === l ? 'var(--sw-forest-900)' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {l === 'en-IN' ? 'EN' : 'हिं'}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 18, minHeight: 120 }}>
            {phase === 'idle' && !reply && (
              <div style={{ fontSize: 13, color: 'var(--sw-ink-400)', lineHeight: 1.6 }}>
                Tap the mic and speak, or type below.<br />
                <span style={{ color: 'var(--sw-ink-800)' }}>Try:</span> "Show me hot leads",
                "How many enquiries need a reply?", "Olivia ke liye kal follow-up task banao".
              </div>
            )}

            {transcript && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sw-ink-400)', textTransform: 'uppercase', marginBottom: 4 }}>You said</div>
                <div style={{ fontSize: 13.5, color: 'var(--sw-ink-800)' }}>{transcript}</div>
              </div>
            )}

            {phase === 'thinking' && (
              <div style={{ fontSize: 13, color: accent, fontWeight: 600 }}>Veda is thinking…</div>
            )}

            {reply && (
              <div style={{ background: 'var(--sw-sand-050)', borderRadius: 10, padding: 12, marginTop: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: accent, textTransform: 'uppercase', marginBottom: 4 }}>Veda</div>
                <div style={{ fontSize: 13.5, color: 'var(--sw-ink-900)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{reply}</div>
                {actions.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {actions.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--sw-forest-700)', fontWeight: 600 }}>✓ {a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {speechSupported && (
              <button
                onClick={phase === 'listening' ? stopListening : startListening}
                disabled={phase === 'thinking'}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  cursor: phase === 'thinking' ? 'default' : 'pointer',
                  background: phase === 'listening' ? 'var(--sw-clay-600)' : 'var(--sw-forest-700)',
                  color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: phase === 'thinking' ? 0.6 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
                </svg>
                {phase === 'listening' ? 'Listening… tap to stop' : 'Tap to speak'}
              </button>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); void send(typed); setTyped(''); }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={speechSupported ? 'Or type a command…' : 'Type a command…'}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 9, fontSize: 13.5,
                  border: '1px solid var(--sw-sand-200)', fontFamily: 'var(--font-body)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'var(--sw-forest-900)', color: '#fff', fontSize: 13, fontWeight: 600,
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
