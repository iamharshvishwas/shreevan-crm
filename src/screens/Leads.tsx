import { useState } from 'react';
import type { AppStore } from '../store';
import { SearchIcon } from '../components/icons';
import { Avatar, Callout, Pill } from '../components/ui';
import { useUsers } from '../api/users';
import { CHANNEL_LABEL, dayLabel, formatMoney } from '../api/enquiries';
import { LEAD_VIEWS, TEMP_STYLE, stageStyle, useLeadsList, type LeadView } from '../api/leads';

const th = {
  textAlign: 'left' as const, padding: '11px 12px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--sw-stone-600)', fontFamily: 'var(--font-body)',
};

export function Leads({ app }: { app: AppStore }) {
  const [view, setView] = useState<LeadView>('active');
  const [ownerId, setOwnerId] = useState('all');
  const [q, setQ] = useState('');
  const users = useUsers();
  const list = useLeadsList(view, ownerId, q);
  const rows = list.data?.data ?? [];

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1440, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Leads</h1>
        <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>
          {list.data ? `${list.data.total} leads` : 'Loading…'} · every active lead should carry a next action.
        </p>
      </div>

      {/* Saved views */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {LEAD_VIEWS.map((v) => {
          const activeV = view === v.key;
          return (
            <button key={v.key} onClick={() => setView(v.key)} className="hov-shadow-sm"
              style={{ height: 32, padding: '0 14px', borderRadius: 999, fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: activeV ? 'var(--sw-forest-900)' : '#ffffff', color: activeV ? '#ffffff' : 'var(--sw-forest-700)', border: activeV ? '1px solid var(--sw-forest-900)' : '1px solid var(--sw-line-soft)' }}>
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Search + owner filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 300 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sw-stone-600)', display: 'flex' }}><SearchIcon size={15} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ width: '100%', height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '0 12px 0 34px', fontFamily: 'var(--font-body)', fontSize: 13, background: '#ffffff' }} />
        </div>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 13, padding: '0 10px', cursor: 'pointer', color: 'var(--sw-ink-900)' }}>
          <option value="all">All owners</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ marginTop: 16, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        {list.error && (
          <div style={{ padding: 20 }}>
            <Callout variant="warning" title="Couldn't load leads">
              <div style={{ fontSize: 12.5 }}>{list.error} <button onClick={() => void list.reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div>
            </Callout>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sw-line-soft)', background: 'var(--sw-sand-050)' }}>
                <th style={{ ...th, paddingLeft: 16 }}>Name</th>
                <th style={th}>Program</th>
                <th style={th}>Source</th>
                <th style={th}>Stage</th>
                <th style={th}>Temp</th>
                <th style={th}>Owner</th>
                <th style={th}>Next action</th>
                <th style={th}>Follow-up</th>
                <th style={{ ...th, textAlign: 'right', paddingRight: 16 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ss = stageStyle(row.stage.key);
                const ts = TEMP_STYLE[row.temperature];
                const noNext = !row.nextAction && !row.confirmedAt && !row.closedLostAt;
                const overdue = !!row.nextActionDate && new Date(row.nextActionDate).getTime() < Date.now();
                return (
                  <tr key={row.id} className="hov-row" style={{ borderBottom: '1px solid var(--sw-line-soft)', background: noNext ? '#f9f3e4' : '#ffffff' }}>
                    <td style={{ padding: '12px 12px 12px 16px' }}>
                      <button onClick={() => app.openLead(row.id)} className="hov-underline-name" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-body)' }}>
                        <div className="lead-name-link" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-forest-900)', textDecoration: 'underline', textDecorationColor: 'transparent' }}>{row.contact.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 1 }}>{row.contact.country ?? '—'}</div>
                      </button>
                    </td>
                    <td style={{ padding: 12, fontSize: 12.5, color: 'var(--sw-ink-900)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.programInterest ?? '—'}</td>
                    <td style={{ padding: 12, fontSize: 12, color: 'var(--sw-stone-600)' }}>{CHANNEL_LABEL[row.firstTouchSource]}</td>
                    <td style={{ padding: 12 }}><Pill bg={ss.bg} fg={ss.fg}>{row.stage.label}</Pill></td>
                    <td style={{ padding: 12 }}><Pill bg={ts.bg} fg={ts.fg} fontSize={11} fontWeight={700} padding="2px 9px" dotSize={5} gap={5}>{ts.label}</Pill></td>
                    <td style={{ padding: 12 }}>
                      {row.owner ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--sw-ink-900)' }}><Avatar name={row.owner.name} size={24} fontSize={9.5} />{row.owner.name.split(' ')[0]}</span> : <span style={{ fontSize: 12, color: 'var(--sw-clay-600)', fontWeight: 600 }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: 12, fontSize: 12.5, fontWeight: 600, color: overdue ? '#9e3f3f' : 'var(--sw-ink-900)', maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nextAction ?? 'No next action'}</td>
                    <td style={{ padding: 12, fontSize: 12.5, color: overdue ? '#9e3f3f' : 'var(--sw-stone-600)', whiteSpace: 'nowrap' }}>{row.nextActionDate ? `${dayLabel(row.nextActionDate)}${overdue ? ' · overdue' : ''}` : '—'}</td>
                    <td style={{ padding: '12px 16px 12px 12px', fontSize: 13, fontWeight: 700, color: 'var(--sw-forest-900)', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(row.expectedValueAmount, row.expectedValueCurrency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.loading && !list.error && rows.length === 0 && (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' }}>No leads in this view</div>
            <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 5 }}>Convert an enquiry, or pick a different saved view.</div>
          </div>
        )}
        {list.loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading leads…</div>}
      </div>
    </div>
  );
}
