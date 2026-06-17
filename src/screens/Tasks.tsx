import { useState } from 'react';
import type { AppStore } from '../store';
import { Avatar, Callout } from '../components/ui';
import { useUsers } from '../api/users';
import { dayLabel } from '../api/enquiries';
import { PRIORITY_STYLE, tasksApi, useTasks, type Task, type TaskBucket } from '../api/work';

const TABS: { key: TaskBucket; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'done', label: 'Completed' },
];

export function Tasks({ app }: { app: AppStore }) {
  const [tab, setTab] = useState<TaskBucket>('today');
  const [ownerId, setOwnerId] = useState('all');
  const users = useUsers();
  const { data, loading, error, reload } = useTasks(ownerId);
  const tasks = data ?? [];
  const count = (b: TaskBucket) => tasks.filter((t) => t.bucket === b).length;
  const rows = tasks.filter((t) => t.bucket === tab);

  async function toggle(t: Task) {
    try { await tasksApi.setDone(t.id, t.status !== 'DONE'); void reload(); }
    catch (e) { app.showToastMsg(e instanceof Error ? e.message : 'Could not update task.'); }
  }

  const ownerName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? 'Owner' : '');

  return (
    <div style={{ padding: '28px 32px 48px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Tasks &amp; follow-ups</h1>
          <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Clear today's list first — overdue items need attention before anything else.</p>
        </div>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ height: 36, border: '1px solid var(--sw-line-soft)', borderRadius: 8, background: '#ffffff', fontFamily: 'var(--font-body)', fontSize: 13, padding: '0 10px', cursor: 'pointer', color: 'var(--sw-ink-900)' }}>
          <option value="all">All owners</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const activeTab = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="hov-shadow-sm" style={{ height: 36, padding: '0 16px', borderRadius: 999, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, background: activeTab ? 'var(--sw-forest-900)' : '#ffffff', color: activeTab ? '#ffffff' : 'var(--sw-forest-700)', border: activeTab ? '1px solid var(--sw-forest-900)' : '1px solid var(--sw-line-soft)' }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: activeTab ? 'rgba(255,255,255,0.18)' : 'var(--sw-mist-100)', color: activeTab ? '#ffffff' : 'var(--sw-forest-700)' }}>{count(t.key)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        {error && <div style={{ padding: 20 }}><Callout variant="warning" title="Couldn't load tasks"><div style={{ fontSize: 12.5 }}>{error} <button onClick={() => void reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div></Callout></div>}
        {loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading tasks…</div>}
        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' }}>
              {tab === 'overdue' ? 'Nothing overdue — the pipeline is well tended.' : tab === 'today' ? 'No tasks due today.' : tab === 'upcoming' ? 'No upcoming tasks scheduled.' : 'No completed tasks yet.'}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((t) => {
            const isOverdue = t.bucket === 'overdue';
            const p = PRIORITY_STYLE[t.priority];
            const done = t.status === 'DONE';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--sw-mist-100)', background: isOverdue ? '#f9eded' : '#ffffff' }}>
                <button onClick={() => toggle(t)} title="Toggle complete" style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${done ? '#2e6a4d' : '#a8b3ad'}`, background: done ? '#2e6a4d' : 'transparent', cursor: 'pointer', flexShrink: 0, color: '#ffffff', fontSize: 11, lineHeight: 1, padding: 0 }}>{done ? '✓' : ''}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--sw-ink-900)', textDecoration: done ? 'line-through' : undefined }}>{t.title}</span>
                    {isOverdue && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f2e0e0', color: '#9e3f3f' }}>Overdue</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', marginTop: 1 }}>
                    {t.leadId ? <button onClick={() => app.openLead(t.leadId!)} className="hov-underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--sw-river-600)' }}>{t.relatedName ?? 'Lead'}</button> : <span>{t.relatedName ?? '—'}</span>}
                    <span> · {t.type}</span>
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: isOverdue ? '#9e3f3f' : 'var(--sw-stone-600)', whiteSpace: 'nowrap' }}>{t.dueAt ? dayLabel(t.dueAt) : 'No date'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: p.bg, color: p.fg }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: p.fg }} />{p.label}</span>
                {t.ownerId ? <Avatar name={ownerName(t.ownerId)} size={26} fontSize={10} /> : <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--sw-clay-600)' }}>—</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
