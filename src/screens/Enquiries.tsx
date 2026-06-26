import { useCallback, useEffect, useState } from 'react';
import type { AppStore } from '../store';
import { BackIcon, Ic, SearchIcon } from '../components/icons';
import { Avatar, Callout, FieldLabel, Pill } from '../components/ui';
import { ConvertToLeadModal } from '../components/ConvertToLeadModal';
import { useUsers } from '../api/users';
import {
  CHANNEL_LABEL, EnquiryDetail, EnquiryListItem, PRIMARY_VIEWS, SLA_STYLE, STATUS_LABEL,
  STATUS_STYLE, dayLabel, enquiriesApi, formatMoney, istFirst, relTime, useEnquiry,
  useEnquiryList,
} from '../api/enquiries';
import type { Channel, EnquiryStatus, Priority, PrimaryView } from '../api/enquiries';

const ICON: Partial<Record<Channel, (string | { c: number[] } | { r: number[] })[]>> = {
  INSTAGRAM: [{ r: [2, 2, 20, 20, 5] }, { c: [12, 12, 4] }, { c: [17.5, 6.5, 0.6] }],
  FACEBOOK: ['M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.5A3.5 3.5 0 0 1 14 6h2v2.8h-1.5c-.7 0-1 .4-1 1v1.2H16l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z'],
  WHATSAPP: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  EMAIL: [{ r: [2, 4, 20, 16, 2] }, 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'],
  WEBSITE_FORM: [{ c: [12, 12, 10] }, 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  PHONE: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
};

function ChannelChip({ channel }: { channel: Channel }) {
  const parts = ICON[channel] ?? [{ c: [12, 12, 9] }];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--sw-stone-600)', background: 'var(--sw-mist-100)', padding: '2px 8px', borderRadius: 999 }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <span style={{ display: 'flex', color: 'var(--sw-forest-700)' }}><Ic parts={parts as any} size={12} /></span>
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

const selectStyle = { height: 34, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 12.5, padding: '0 8px', cursor: 'pointer', color: 'var(--sw-ink-900)' } as const;

export function Enquiries({ app }: { app: AppStore }) {
  const [view, setView] = useState<PrimaryView>('needs_reply');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [ownerId, setOwnerId] = useState<string | 'all'>('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<PrimaryView, number>>>({});

  const users = useUsers();
  const list = useEnquiryList({ view, channel, ownerId, priority, q });
  const detail = useEnquiry(selectedId);

  const refreshCounts = useCallback(() => {
    Promise.all(PRIMARY_VIEWS.map((v) => enquiriesApi.list({ view: v.key, page: 1 }).then((r) => [v.key, r.total] as const).catch(() => [v.key, 0] as const)))
      .then((entries) => setCounts(Object.fromEntries(entries)));
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  const refreshAll = useCallback(() => { void list.reload(); void detail.reload(); refreshCounts(); }, [list, detail, refreshCounts]);

  // Keep the tab badge counts live (they used to update only on mount/action).
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refreshCounts(); };
    const t = window.setInterval(tick, 15_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(t); window.removeEventListener('focus', tick); };
  }, [refreshCounts]);

  async function act(fn: () => Promise<unknown>, ok: string | ((r: unknown) => string)) {
    try { const r = await fn(); app.showToastMsg(typeof ok === 'function' ? ok(r) : ok); refreshAll(); }
    catch (e) { app.showToastMsg(e instanceof Error ? e.message : 'Action failed.'); }
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (channel !== 'all') activeChips.push({ label: `Channel: ${CHANNEL_LABEL[channel]}`, clear: () => setChannel('all') });
  if (ownerId !== 'all') activeChips.push({ label: `Owner: ${users.find((u) => u.id === ownerId)?.name.split(' ')[0] ?? 'set'}`, clear: () => setOwnerId('all') });
  if (priority !== 'all') activeChips.push({ label: `Priority: ${priority}`, clear: () => setPriority('all') });

  return (
    <div className={`inbox${selectedId ? ' inbox--sel' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 14px 24px', borderBottom: '1px solid var(--sw-line-soft)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Enquiries</h1>
            <p style={{ margin: '5px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>
              Review, qualify and route enquiries received across every channel
              {counts.needs_reply !== undefined && <> · <strong style={{ color: 'var(--sw-clay-600)' }}>{counts.needs_reply} need a reply</strong></>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--sw-stone-600)', display: 'flex' }}><SearchIcon size={14} /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search enquiries…" style={{ width: 220, height: 34, border: '1px solid var(--sw-line-soft)', borderRadius: 999, padding: '0 12px 0 32px', fontFamily: 'var(--font-body)', fontSize: 12.5, background: 'var(--sw-sand-050)' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowFilters(!showFilters)} className="hov-mist" style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#ffffff', color: 'var(--sw-forest-700)', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                More filters{activeChips.length > 0 ? ` · ${activeChips.length}` : ''}
                <Ic parts={['m6 9 6 6 6-6']} size={13} strokeWidth={2} />
              </button>
              {showFilters && (
                <div style={{ position: 'absolute', top: 40, right: 0, width: 260, background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 14, zIndex: 70, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <FieldLabel>Channel</FieldLabel>
                    <select value={channel} onChange={(e) => setChannel(e.target.value as Channel | 'all')} style={{ ...selectStyle, width: '100%', height: 36, marginTop: 4 }}>
                      <option value="all">All channels</option>
                      {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Owner</FieldLabel>
                    <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...selectStyle, width: '100%', height: 36, marginTop: 4 }}>
                      <option value="all">All owners</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Priority</FieldLabel>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')} style={{ ...selectStyle, width: '100%', height: 36, marginTop: 4 }}>
                      <option value="all">Any priority</option>
                      <option value="HIGH">High (hot)</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                  <button onClick={() => setShowFilters(false)} className="hov-forest-deep" style={{ height: 34, borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Done</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Primary views */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {PRIMARY_VIEWS.map((v) => {
            const activeV = view === v.key;
            return (
              <button key={v.key} onClick={() => setView(v.key)} className="hov-shadow-sm" style={{ height: 32, padding: '0 14px', borderRadius: 999, fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7, background: activeV ? 'var(--sw-forest-900)' : '#ffffff', color: activeV ? '#ffffff' : 'var(--sw-forest-700)', border: activeV ? '1px solid var(--sw-forest-900)' : '1px solid var(--sw-line-soft)' }}>
                {v.label}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '0 7px', borderRadius: 999, background: activeV ? 'rgba(255,255,255,0.2)' : 'var(--sw-mist-100)', color: activeV ? '#fff' : 'var(--sw-forest-700)' }}>{counts[v.key] ?? '·'}</span>
              </button>
            );
          })}
        </div>

        {activeChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {activeChips.map((chip, i) => (
              <button key={i} onClick={chip.clear} className="hov-mist" style={{ height: 26, padding: '0 8px 0 12px', borderRadius: 999, border: '1px solid var(--sw-line-mist)', background: 'var(--sw-mist-100)', color: 'var(--sw-forest-700)', fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {chip.label}<Ic parts={['M18 6 6 18', 'm6 6 12 12']} size={11} strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="inbox-grid" style={{ flex: 1, minHeight: 0 }}>
        <QueueList list={list} users={users} selectedId={selectedId} onSelect={setSelectedId} />
        <ActiveConversation app={app} detail={detail} users={users} act={act} onConvert={() => setShowConvert(true)} onBack={() => setSelectedId(null)} />
        <ContextPanel detail={detail.data} />
      </div>

      {showConvert && detail.data && (
        <ConvertToLeadModal
          enquiry={detail.data}
          users={users}
          onCancel={() => setShowConvert(false)}
          onConverted={(msg) => { setShowConvert(false); app.showToastMsg(msg); refreshAll(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QueueList({ list, users, selectedId, onSelect }: { list: ReturnType<typeof useEnquiryList>; users: ReturnType<typeof useUsers>; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="inbox-queue" style={{ borderRight: '1px solid var(--sw-line-soft)', overflowY: 'auto', background: '#ffffff' }}>
      {list.loading && <div style={{ padding: 24, fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading enquiries…</div>}
      {list.error && (
        <div style={{ padding: 24 }}>
          <Callout variant="warning" title="Couldn't load enquiries">
            <div style={{ fontSize: 12.5 }}>{list.error}
              <div style={{ marginTop: 8 }}><button onClick={() => void list.reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div>
            </div>
          </Callout>
        </div>
      )}
      {!list.loading && !list.error && list.data?.data.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15.5, color: 'var(--sw-ink-900)' }}>No enquiries here</div>
          <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 4 }}>Try another view or clear the filters.</div>
        </div>
      )}
      {list.data?.data.map((e: EnquiryListItem) => {
        const selected = e.id === selectedId;
        return (
          <button key={e.id} onClick={() => onSelect(e.id)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--sw-line-soft)', padding: '12px 16px', fontFamily: 'var(--font-body)', background: selected ? 'var(--sw-mist-100)' : '#ffffff', borderLeft: selected ? '3px solid var(--sw-forest-900)' : '3px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.contact.name}</span>
              <span style={{ fontSize: 11, color: 'var(--sw-stone-600)', whiteSpace: 'nowrap' }}>{dayLabel(e.lastMessageAt)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <ChannelChip channel={e.channel} />
              {e.leadId && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sw-forest-700)', background: '#e4efe8', padding: '2px 7px', borderRadius: 999 }}>Lead</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.programInterest ?? 'New enquiry'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Pill bg={STATUS_STYLE[e.status].bg} fg={STATUS_STYLE[e.status].fg} fontSize={10.5} padding="2px 8px" dotSize={5} gap={5}>{STATUS_LABEL[e.status]}</Pill>
              {e.priority === 'HIGH' && <Pill bg="#f1e8d3" fg="#806019" fontSize={10.5} padding="2px 8px" dotSize={5} gap={5}>Hot</Pill>}
              <span style={{ flex: 1 }} />
              {e.ownerId
                ? <Avatar name={users.find((u) => u.id === e.ownerId)?.name ?? 'Assigned'} size={22} fontSize={9} />
                : <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--sw-clay-600)' }}>Unassigned</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ActiveConversation({
  app, detail, users, act, onConvert, onBack,
}: {
  app: AppStore;
  detail: ReturnType<typeof useEnquiry>;
  users: ReturnType<typeof useUsers>;
  act: (fn: () => Promise<unknown>, ok: string | ((r: unknown) => string)) => Promise<void>;
  onConvert: () => void;
  onBack: () => void;
}) {
  const [reply, setReply] = useState('');
  const [showActions, setShowActions] = useState(false);
  const e = detail.data;

  if (!e) {
    return (
      <div className="inbox-conv" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sw-sand-050)' }}>
        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--sw-ink-900)' }}>
            {detail.loading ? 'Loading…' : 'Select an enquiry'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 5 }}>Pick one from the list to read and respond.</div>
        </div>
      </div>
    );
  }

  const ss = STATUS_STYLE[e.status];
  const sla = SLA_STYLE[e.sla.state];
  const messages = e.conversations.flatMap((c) => c.messages);
  type Row = { t: string; kind: 'msg'; m: typeof messages[number] } | { t: string; kind: 'note'; n: typeof e.notes[number] };
  const rows: Row[] = [
    ...messages.map((m) => ({ t: m.occurredAt, kind: 'msg' as const, m })),
    ...e.notes.map((n) => ({ t: n.createdAt, kind: 'note' as const, n })),
  ].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  let lastDay = '';
  const menuItem = { width: '100%', textAlign: 'left' as const, background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 12px', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--sw-ink-900)' };
  const run = (fn: () => Promise<unknown>, ok: string) => { setShowActions(false); void act(fn, ok); };

  return (
    <div className="inbox-conv" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--sw-sand-050)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--sw-line-soft)', background: '#ffffff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} className="inbox-back hov-mist" style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--sw-line-soft)', background: '#fff', cursor: 'pointer', color: 'var(--sw-forest-700)', flexShrink: 0 }} title="Back"><BackIcon /></button>
          <Avatar name={e.contact.name} size={40} fontSize={13} bg="var(--sw-mist-100)" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--sw-ink-900)' }}>{e.contact.name}</span>
              <Pill bg={ss.bg} fg={ss.fg} fontSize={11} padding="3px 10px">{STATUS_LABEL[e.status]}</Pill>
              {e.sla.state !== 'none' && <Pill bg={sla.bg} fg={sla.fg} fontSize={10.5} padding="2px 8px" dotSize={5} gap={5}>{sla.label}</Pill>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <ChannelChip channel={e.channel} />
              <span style={{ fontSize: 12, color: 'var(--sw-stone-600)' }}>{e.owner ? `Owner: ${e.owner.name}` : 'Unassigned'}</span>
            </div>
          </div>
          {e.leadId && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sw-forest-700)', background: '#e4efe8', padding: '4px 10px', borderRadius: 999, flexShrink: 0, alignSelf: 'flex-start' }}>Converted to lead</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={e.owner?.id ?? ''} onChange={(ev) => run(() => enquiriesApi.assign(e.id, ev.target.value), 'Assigned.')} style={{ ...selectStyle, width: 130, flexShrink: 0 }} title="Assign owner">
            <option value="" disabled>Assign…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value="" onChange={(ev) => { if (ev.target.value) run(() => enquiriesApi.setStatus(e.id, ev.target.value as EnquiryStatus), 'Status updated.'); }} style={{ ...selectStyle, width: 116, flexShrink: 0 }} title="Set status">
            <option value="">Status…</option>
            <option value="NEEDS_REPLY">Needs reply</option>
            <option value="WAITING_FOR_CUSTOMER">Waiting for customer</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowActions(!showActions)} className="hov-forest-deep" style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Actions <Ic parts={['m6 9 6 6 6-6']} size={13} strokeWidth={2} />
            </button>
            {showActions && (
              <div style={{ position: 'absolute', top: 40, right: 0, width: 230, background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 6, zIndex: 70 }}>
                {!e.leadId && <button className="hov-mist" style={{ ...menuItem, fontWeight: 600, color: 'var(--sw-forest-900)' }} onClick={() => { setShowActions(false); onConvert(); }}>Convert to lead</button>}
                <button className="hov-mist" style={menuItem} onClick={() => { const n = window.prompt('Internal note (team only):'); if (n?.trim()) run(() => enquiriesApi.addNote(e.id, n.trim()), 'Note added.'); else setShowActions(false); }}>Add internal note</button>
                <button className="hov-mist" style={menuItem} onClick={() => run(() => enquiriesApi.createTask(e.id, `Follow up with ${e.contact.name}`, new Date(Date.now() + 86_400_000).toISOString()), 'Follow-up task created (see Tasks).')}>Create follow-up task</button>
                <button className="hov-mist" style={menuItem} onClick={() => run(() => enquiriesApi.scheduleCall(e.id, new Date(Date.now() + 86_400_000).toISOString(), e.contact.timezone ?? 'Asia/Kolkata'), 'Added to Discovery calls.')}>Schedule discovery call</button>
                <div style={{ height: 1, background: 'var(--sw-line-soft)', margin: '6px 4px' }} />
                <button className="hov-mist" style={menuItem} onClick={() => run(() => enquiriesApi.resolve(e.id), 'Enquiry resolved.')}>Resolve enquiry</button>
                <button className="hov-mist" style={{ ...menuItem, color: 'var(--sw-error)' }} onClick={() => run(() => enquiriesApi.setStatus(e.id, 'SPAM'), 'Marked as spam.')}>Mark as spam</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => {
          const showDay = dayLabel(row.t) !== lastDay;
          lastDay = dayLabel(row.t);
          return (
            <div key={i}>
              {showDay && <div style={{ textAlign: 'center', margin: '4px 0 12px 0' }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sw-stone-600)', background: 'var(--sw-sand-100)', padding: '3px 12px', borderRadius: 999 }}>{dayLabel(row.t)}</span></div>}
              {row.kind === 'note' ? (
                <div style={{ background: 'var(--sw-warning-bg)', border: '1px solid #e3d3a8', borderRadius: 10, padding: '10px 14px', maxWidth: 560, margin: '0 auto' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sw-warning)', marginBottom: 3 }}>Internal note · {row.n.authorName}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--sw-ink-900)' }}>{row.n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--sw-stone-600)', marginTop: 4 }}>{istFirst(row.n.createdAt, e.contact.timezone)}</div>
                </div>
              ) : (
                <Bubble m={row.m} tz={e.contact.timezone} />
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--sw-stone-600)', marginTop: 20 }}>No messages yet.</div>}
      </div>

      {/* composer */}
      <div style={{ borderTop: '1px solid var(--sw-line-soft)', background: '#ffffff', padding: '12px 16px', flexShrink: 0 }}>
        {(() => {
          const canSend = e.channel === 'WHATSAPP' || e.channel === 'EMAIL';
          return (
            <div style={{ fontSize: 11.5, color: canSend ? 'var(--sw-forest-700)' : 'var(--sw-warning)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: canSend ? 'var(--sw-success, #15803d)' : 'var(--sw-warning)' }} />
              {canSend
                ? `Replies are delivered to the customer on ${CHANNEL_LABEL[e.channel]} (logged instead if the channel isn't connected).`
                : `${CHANNEL_LABEL[e.channel]} has no outbound — replies are recorded as an internal log.`}
            </div>
          );
        })()}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea value={reply} onChange={(ev) => setReply(ev.target.value)} rows={2} placeholder="Write a response…" style={{ flex: 1, border: '1px solid var(--sw-line-soft)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--sw-ink-900)', resize: 'vertical' }} />
          <button onClick={() => { if (reply.trim()) { void act(() => enquiriesApi.respond(e.id, reply.trim()), (r) => (r as { detail?: string })?.detail ?? 'Response recorded.'); setReply(''); } else { app.showToastMsg('Write a response first.'); } }} className="hov-forest-deep" style={{ height: 40, padding: '0 18px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{e.channel === 'WHATSAPP' || e.channel === 'EMAIL' ? 'Send reply' : 'Log response'}</button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m, tz }: { m: EnquiryDetail['conversations'][number]['messages'][number]; tz: string | null }) {
  const out = m.direction === 'OUTBOUND';
  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{ background: out ? 'var(--sw-forest-900)' : '#ffffff', color: out ? '#ffffff' : 'var(--sw-ink-900)', border: out ? '1px solid var(--sw-forest-900)' : '1px solid var(--sw-line-soft)', borderRadius: out ? '12px 12px 4px 12px' : '12px 12px 12px 4px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>{m.body}</div>
        <div style={{ fontSize: 10.5, color: 'var(--sw-stone-600)', marginTop: 3, textAlign: out ? 'right' : 'left' }}>
          {out ? `${m.authorName} · ` : ''}{istFirst(m.occurredAt, tz)}{m.delivery === 'LOGGED' && ' · logged'}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ContextPanel({ detail }: { detail: EnquiryDetail | null }) {
  if (!detail) return <div className="inbox-context" style={{ borderLeft: '1px solid var(--sw-line-soft)', background: '#ffffff' }} />;
  const c = detail.contact;
  return (
    <div className="inbox-context" style={{ borderLeft: '1px solid var(--sw-line-soft)', background: '#ffffff', overflowY: 'auto', padding: '18px 18px 32px 18px' }}>
      <h2 style={{ margin: '0 0 12px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15.5, color: 'var(--sw-ink-900)' }}>Contact</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <FieldLabel>Channel identities</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {c.identities.map((id) => (
              <div key={id.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--sw-ink-900)' }}>
                <ChannelChip channel={id.channel} /> {id.handle}{!id.verified && <span style={{ fontSize: 10, color: 'var(--sw-warning)', fontWeight: 700 }}>· unverified</span>}
              </div>
            ))}
          </div>
        </div>
        <Row label="Preferred contact" value={c.preferredContact ?? '—'} />
        <Row label="Country · time zone" value={`${c.country ?? '—'}${c.timezone ? ` · ${c.timezone.split('/')[1]?.replace('_', ' ')}` : ''}`} />
        <Row label="Language" value={c.language ?? '—'} />
        <Row label="First-touch source" value={CHANNEL_LABEL[detail.firstTouchSource]} />
        <Row label="Current channel" value={CHANNEL_LABEL[detail.channel]} />
      </div>

      <h2 style={{ margin: '20px 0 12px 0', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15.5, color: 'var(--sw-ink-900)' }}>Opportunity</h2>
      {detail.leadId ? (
        <div style={{ background: 'var(--sw-mist-100)', border: '1px solid var(--sw-line-mist)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--sw-ink-900)' }}>Converted to a qualified lead.</div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--sw-stone-600)', lineHeight: 1.5 }}>Not yet a lead. Use <strong>Actions → Convert to lead</strong> once qualified.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <Row label="Program interest" value={detail.programInterest ?? '—'} />
        <Row label="Expected value" value={formatMoney(detail.expectedValueAmount, detail.expectedValueCurrency)} />
        <Row label="First-response SLA" value={SLA_STYLE[detail.sla.state].label} />
        <Row label="Next action" value={detail.nextAction ?? 'None set'} />
        {detail.notes[0] && <Row label="Latest note" value={`${detail.notes[0].body} · ${relTime(detail.notes[0].createdAt)}`} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ fontSize: 12.5, color: 'var(--sw-ink-900)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
