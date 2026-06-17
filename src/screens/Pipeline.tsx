import { useState, type DragEvent } from 'react';
import type { AppStore } from '../store';
import { CalendarIcon } from '../components/icons';
import { Avatar, Callout, Pill } from '../components/ui';
import { useUsers } from '../api/users';
import { CHANNEL_LABEL, formatMoney } from '../api/enquiries';
import { TEMP_STYLE, leadsApi, usePipelineBoard, type BoardCard } from '../api/leads';

function sumsLabel(sums: { USD: number; INR: number }): string {
  const parts: string[] = [];
  if (sums.USD) parts.push(formatMoney(sums.USD, 'USD'));
  if (sums.INR) parts.push(formatMoney(sums.INR, 'INR'));
  return parts.length ? parts.join(' · ') : '—';
}

export function Pipeline({ app }: { app: AppStore }) {
  const board = usePipelineBoard();
  const users = useUsers();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  async function drop(e: DragEvent, stageKey: string, stageLabel: string) {
    e.preventDefault();
    const id = dragId;
    setDragId(null);
    setDragOver(null);
    if (!id) return;
    const card = board.data?.flatMap((c) => c.leads).find((l) => l.id === id);
    if (!card) return;
    try {
      await leadsApi.moveStage(id, stageKey);
      app.showToastMsg(`${card.name} moved to ${stageLabel}.`);
      void board.reload();
    } catch (err) {
      app.showToastMsg(err instanceof Error ? err.message : 'Could not move lead.');
    }
  }

  const ownerName = (ownerId: string | null) => (ownerId ? users.find((u) => u.id === ownerId)?.name ?? 'Owner' : '');

  return (
    <div style={{ padding: '28px 32px 24px 32px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--sw-ink-900)' }}>Booking pipeline</h1>
        <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: 'var(--sw-stone-600)' }}>Drag a card to move it between stages — saved to the server.</p>
      </div>

      {board.loading && <div style={{ fontSize: 13, color: 'var(--sw-stone-600)' }}>Loading pipeline…</div>}
      {board.error && (
        <Callout variant="warning" title="Couldn't load the pipeline">
          <div style={{ fontSize: 12.5 }}>{board.error} <button onClick={() => void board.reload()} className="hov-underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sw-river-600)', fontWeight: 700, fontSize: 12.5 }}>Retry</button></div>
        </Callout>
      )}

      {board.data && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 14, height: '100%', minHeight: 480 }}>
            {board.data.map((col) => {
              const isOver = dragOver === col.key;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => { e.preventDefault(); if (dragOver !== col.key) setDragOver(col.key); }}
                  onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(null); }}
                  onDrop={(e) => drop(e, col.key, col.label)}
                  style={{
                    width: 282, flexShrink: 0, display: 'flex', flexDirection: 'column', background: isOver ? '#e0ebef' : 'var(--sw-sand-100)',
                    borderRadius: 12, transition: 'background 160ms', outline: isOver ? '2px dashed var(--sw-river-600)' : undefined, outlineOffset: isOver ? -2 : undefined,
                    opacity: !isOver && col.key === 'closed_lost' ? 0.92 : 1,
                  }}
                >
                  <div style={{ padding: '13px 14px 9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sw-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, background: '#ffffff', color: 'var(--sw-forest-700)', border: '1px solid var(--sw-line-soft)', padding: '1px 8px', borderRadius: 999, flexShrink: 0 }}>{col.count}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 3 }}>{sumsLabel(col.sums)}</div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {col.leads.map((card) => (
                      <Card key={card.id} card={card} ownerName={ownerName(card.ownerId)} dragging={dragId === card.id}
                        onDragStart={(e) => { setDragId(card.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => app.openLead(card.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ card, ownerName, dragging, onDragStart, onDragEnd, onClick }: {
  card: BoardCard; ownerName: string; dragging: boolean;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void; onClick: () => void;
}) {
  const ts = TEMP_STYLE[card.temperature];
  const overdue = !!card.nextActionDate && new Date(card.nextActionDate).getTime() < Date.now();
  const nextTone = overdue ? '#9e3f3f' : 'var(--sw-stone-600)';
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} className="hov-card"
      style={{ background: '#ffffff', border: '1px solid var(--sw-line-soft)', borderRadius: 11, padding: '12px 13px', cursor: 'grab', boxShadow: 'var(--shadow-sm)', opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sw-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</span>
        <Pill bg={ts.bg} fg={ts.fg} fontSize={10.5} fontWeight={700} padding="2px 8px" dotSize={5} gap={5}>{ts.label}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--sw-stone-600)', marginTop: 2 }}>
        {card.country ?? '—'}{card.timezone ? ` · ${card.timezone.split('/')[1]?.replace('_', ' ')}` : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--sw-ink-900)', marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.programInterest ?? '—'}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sw-forest-900)' }}>{formatMoney(card.expectedValueAmount, card.expectedValueCurrency)}</span>
      </div>
      {card.nextAction && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--sw-line-soft)' }}>
          <span style={{ display: 'flex', flexShrink: 0, marginTop: 1, color: nextTone }}><CalendarIcon size={12} strokeWidth={2} /></span>
          <span style={{ fontSize: 11.5, lineHeight: 1.45, fontWeight: 600, color: nextTone }}>{card.nextAction}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 }}>
        {ownerName ? <Avatar name={ownerName} size={24} fontSize={9.5} /> : <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--sw-clay-600)' }}>Unassigned</span>}
        <span style={{ fontSize: 10.5, color: 'var(--sw-stone-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CHANNEL_LABEL[card.firstTouchSource]}</span>
      </div>
    </div>
  );
}
