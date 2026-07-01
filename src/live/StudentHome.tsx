import type { ParticipantStore } from './useParticipant';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  ready: boolean;
}

const TILES: Tile[] = [
  { key: 'programs', title: 'Programs', subtitle: 'Guided multi-day programs', icon: '🌱', ready: false },
  { key: 'masterclass', title: 'Masterclass', subtitle: 'Live classes & sessions', icon: '🎥', ready: true },
  { key: 'resources', title: 'Resources', subtitle: 'Guides & downloads', icon: '📚', ready: false },
  { key: 'library', title: 'Library', subtitle: 'Recordings & past sessions', icon: '🎬', ready: false },
];

export function StudentHome({ store, onOpenMasterclass }: { store: ParticipantStore; onOpenMasterclass: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--sw-sand-050)', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: '#fff', borderBottom: '1px solid var(--sw-line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/shreevan-mark-on-forest.png" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>Shreevan Wellness</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{store.participant?.name}</span>
          <button onClick={store.logout} style={{ background: 'none', border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-ink-900)', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 48px' }}>
        <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>
          Namaste {store.participant?.name?.split(' ')[0]} 🌿
        </h1>
        <p style={{ margin: '0 0 26px', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Choose where you’d like to begin.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {TILES.map((t) => (
            <button
              key={t.key}
              onClick={t.ready ? onOpenMasterclass : undefined}
              disabled={!t.ready}
              className={t.ready ? 'hov-card' : undefined}
              style={{
                textAlign: 'left',
                background: '#fff',
                border: '1px solid var(--sw-line-soft)',
                borderRadius: 'var(--radius-card)',
                padding: '20px 20px 22px',
                cursor: t.ready ? 'pointer' : 'default',
                opacity: t.ready ? 1 : 0.62,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 132,
                transition: 'box-shadow 160ms, transform 160ms',
              }}
            >
              <div style={{ fontSize: 30 }}>{t.icon}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' }}>{t.title}</span>
                {!t.ready && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--sw-stone-600)', background: 'var(--sw-line-soft)', borderRadius: 999, padding: '2px 8px' }}>Soon</span>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>{t.subtitle}</span>
              {t.ready && <span style={{ marginTop: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--sw-forest-700)' }}>Open →</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
