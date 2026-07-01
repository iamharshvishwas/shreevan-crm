export function ClassEndedOverlay({ onLeave }: { onLeave: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,26,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: 'var(--font-body)' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 36px', textAlign: 'center', maxWidth: 360, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>🌿</div>
        <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, color: 'var(--sw-ink-900)' }}>This class has ended</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>The host has ended the session. Thanks for joining!</p>
        <button onClick={onLeave} className="hov-forest-deep"
          style={{ height: 42, padding: '0 24px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          Back to classes
        </button>
      </div>
    </div>
  );
}
