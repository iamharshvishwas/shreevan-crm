interface ProgramStat {
  label: string;
  value: string;
}

interface Program {
  featured?: boolean;
  badge: string;
  badgeBg: string;
  badgeFg: string;
  activeLeads: string;
  name: string;
  descriptor: string;
  stats: ProgramStat[];
}

const PROGRAMS: Program[] = [
  {
    featured: true,
    badge: 'Flagship · 28-day',
    badgeBg: 'rgba(255,255,255,0.14)',
    badgeFg: '#ffffff',
    activeLeads: '4 active leads',
    name: '28-Day Personal Reset',
    descriptor: 'A structured immersion designed to help guests step away, rebuild sustainable routines and return with greater clarity.',
    stats: [
      { label: 'Price', value: '$4,200 · ₹2,95,000' },
      { label: 'Next cohorts', value: '1 Jul · 1 Aug' },
      { label: 'July capacity', value: '11 of 16 booked' },
    ],
  },
  {
    badge: '14-day',
    badgeBg: 'var(--sw-river-100)',
    badgeFg: 'var(--sw-river-700)',
    activeLeads: '4 active leads',
    name: '14-Day Foundations Program',
    descriptor: 'A two-week introduction to the core practices — ideal for first-time guests with limited leave.',
    stats: [
      { label: 'Price', value: '$2,400 · ₹1,45,000' },
      { label: 'Next cohorts', value: '6 Jul · 3 Aug' },
      { label: 'July capacity', value: '7 of 12 booked' },
    ],
  },
  {
    badge: '28-day',
    badgeBg: 'var(--sw-moss-100)',
    badgeFg: 'var(--sw-forest-700)',
    activeLeads: '2 active leads',
    name: '28-Day Practice Immersion',
    descriptor: 'For established practitioners deepening asana, pranayama and meditation within a daily rhythm.',
    stats: [
      { label: 'Price', value: '$4,600 · ₹3,20,000' },
      { label: 'Next cohort', value: '1 Jul' },
      { label: 'July capacity', value: '9 of 12 booked' },
    ],
  },
  {
    badge: '28-day',
    badgeBg: 'var(--sw-moss-100)',
    badgeFg: 'var(--sw-forest-700)',
    activeLeads: '3 active leads',
    name: '28-Day Clarity Retreat',
    descriptor: 'Reflection-led variant pairing meditation and journaling with one-to-one guidance sessions.',
    stats: [
      { label: 'Price', value: '$4,400 · ₹3,10,000' },
      { label: 'Next cohorts', value: '1 Jul · 1 Oct' },
      { label: 'July capacity', value: '8 of 12 booked' },
    ],
  },
  {
    badge: '60-day',
    badgeBg: 'var(--sw-gold-100)',
    badgeFg: 'var(--sw-warning)',
    activeLeads: '2 active leads',
    name: '60-Day Integration Masterclass',
    descriptor: 'Application-only long format for returning guests and serious practitioners; includes a teaching track.',
    stats: [
      { label: 'Price', value: '$8,900 · ₹6,20,000' },
      { label: 'Next cohort', value: '1 Sep' },
      { label: 'Sep capacity', value: '3 of 8 booked' },
    ],
  },
];

export function Programs() {
  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Programs</h1>
      <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>
        Capacity and active pipeline interest per program. Pricing shown for international / Indian leads.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14, marginTop: 24 }}>
        {PROGRAMS.map((p) => {
          const onForest = !!p.featured;
          return (
            <div
              key={p.name}
              style={{
                background: onForest ? 'var(--sw-forest-900)' : '#ffffff',
                border: onForest ? '1px solid var(--sw-forest-900)' : '1px solid var(--sw-line-soft)',
                borderRadius: 'var(--radius-card)',
                padding: '22px 24px',
                color: onForest ? '#ffffff' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: p.badgeBg, color: p.badgeFg, padding: '3px 10px', borderRadius: 6 }}>
                  {p.badge}
                </span>
                <span style={{ fontSize: 12, color: onForest ? 'rgba(255,255,255,0.7)' : 'var(--sw-stone-600)' }}>{p.activeLeads}</span>
              </div>
              <h2 style={{ margin: '14px 0 4px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: onForest ? '#ffffff' : 'var(--sw-ink-900)' }}>
                {p.name}
              </h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: onForest ? 'rgba(255,255,255,0.78)' : 'var(--sw-stone-600)' }}>
                {p.descriptor}
              </p>
              <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${onForest ? 'rgba(255,255,255,0.16)' : 'var(--sw-line-soft)'}` }}>
                {p.stats.map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: onForest ? 'rgba(255,255,255,0.6)' : 'var(--sw-stone-600)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: s.label === 'Price' ? 14 : 13, fontWeight: s.label === 'Price' ? 700 : 400, marginTop: 3, color: onForest ? '#ffffff' : s.label === 'Price' ? 'var(--sw-forest-900)' : 'var(--sw-ink-900)' }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
