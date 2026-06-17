import { useEffect, useState } from 'react';
import type { AppStore } from '../store';
import { BellIcon, PlusIcon, SearchIcon } from './icons';
import { CHANNEL_LABEL, enquiriesApi, relTime, type EnquiryListItem } from '../api/enquiries';
import { leadsApi, type LeadListItem } from '../api/leads';
import { notifColor, useNotifications } from '../api/notifications';

export function Topbar({ app }: { app: AppStore }) {
  const gq = app.globalQuery.trim();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryListItem[]>([]);
  const notif = useNotifications();

  useEffect(() => {
    if (!gq) { setLeads([]); setEnquiries([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      Promise.all([
        leadsApi.list('all', undefined, gq).then((r) => r.data.slice(0, 4)).catch(() => []),
        enquiriesApi.list({ view: 'all', q: gq }).then((r) => r.data.slice(0, 4)).catch(() => []),
      ]).then(([l, e]) => { if (alive) { setLeads(l); setEnquiries(e); } });
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [gq]);

  const empty = gq && leads.length === 0 && enquiries.length === 0;

  return (
    <header style={{ height: 64, flexShrink: 0, background: '#ffffff', borderBottom: '1px solid var(--sw-line-soft)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
      {/* Global search */}
      <div style={{ position: 'relative', width: 380, maxWidth: '40vw' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sw-stone-600)', display: 'flex' }}><SearchIcon /></span>
        <input value={app.globalQuery} onChange={(e) => app.setGlobalQuery(e.target.value)} placeholder="Search leads & enquiries…"
          style={{ width: '100%', height: 38, border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-pill)', padding: '0 14px 0 36px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--sw-ink-900)', background: 'var(--sw-sand-050)' }} />
        {!!gq && (
          <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 6, zIndex: 60, animation: 'sw-fade-in 160ms var(--ease-calm)' }}>
            {leads.length > 0 && <Group label="Leads" />}
            {leads.map((l) => (
              <button key={l.id} onClick={() => { app.openLead(l.id); app.setGlobalQuery(''); }} className="hov-mist" style={rowStyle}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{l.contact.name}</span>
                <span style={{ fontSize: 12, color: 'var(--sw-stone-600)' }}>{l.stage.label}</span>
              </button>
            ))}
            {enquiries.length > 0 && <Group label="Enquiries" />}
            {enquiries.map((e) => (
              <button key={e.id} onClick={() => { app.goNav('enquiries'); app.setGlobalQuery(''); }} className="hov-mist" style={rowStyle}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>{e.contact.name}</span>
                <span style={{ fontSize: 12, color: 'var(--sw-stone-600)' }}>{CHANNEL_LABEL[e.channel]}</span>
              </button>
            ))}
            {empty && <div style={{ padding: '12px 10px', fontSize: 13, color: 'var(--sw-stone-600)' }}>Nothing matches “{gq}”.</div>}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => app.setShowNotif(!app.showNotif)} title="Notifications" className="hov-mist"
          style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--sw-line-soft)', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sw-forest-700)' }}>
          <BellIcon />
          {notif.unread > 0 && <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--sw-clay-600)', border: '2px solid #ffffff' }} />}
        </button>
        {app.showNotif && (
          <div style={{ position: 'absolute', top: 46, right: 0, width: 340, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 60, animation: 'sw-fade-in 160ms var(--ease-calm)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--sw-line-soft)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>Notifications</span>
              <button onClick={() => void notif.markAllRead()} className="hov-mist" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--sw-river-600)', padding: '4px 6px', borderRadius: 6 }}>Mark all read</button>
            </div>
            {notif.items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)' }}>You're all caught up</div>
                <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 4 }}>New enquiries and reminders will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto' }}>
                {notif.items.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: i < notif.items.length - 1 ? '1px solid var(--sw-line-soft)' : 'none', opacity: n.readAt ? 0.6 : 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: notifColor(n.type), marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--sw-ink-900)' }}><strong>{n.title}</strong>{n.body ? ` — ${n.body}` : ''}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 2 }}>{relTime(n.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-add enquiry */}
      <button onClick={() => { app.setShowAddLead(true); app.setAddError(false); }} className="hov-forest-deep"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, lineHeight: 1.2, padding: '8px 16px', minHeight: 36, borderRadius: 'var(--radius-pill)', border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background var(--dur-fast) var(--ease-calm)' }}>
        <PlusIcon />
        Add enquiry
      </button>
    </header>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, fontFamily: 'var(--font-body)' };

function Group({ label }: { label: string }) {
  return <div style={{ padding: '8px 10px 4px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sw-stone-600)' }}>{label}</div>;
}
