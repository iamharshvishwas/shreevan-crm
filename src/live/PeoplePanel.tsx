import type { ReactNode } from 'react';
import { useHMSActions, useHMSStore, selectPeers } from '@100mslive/react-sdk';
import type { Roles } from './roomTypes';

/** Peer fields this panel uses (structural subset of HMSPeer). */
interface Peer { id: string; name: string; isLocal: boolean; roleName?: string; audioTrack?: string; isHandRaised: boolean }

const MAX_VIEWERS_SHOWN = 40;

const chip = (bg: string, color: string) => ({
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  color, background: bg, borderRadius: 999, padding: '2px 7px', flexShrink: 0,
});

const miniBtn = {
  height: 24, padding: '0 9px', borderRadius: 999, border: '1px solid var(--sw-line-soft)',
  background: '#fff', color: 'var(--sw-ink-900)', fontFamily: 'var(--font-body)', fontSize: 11,
  fontWeight: 600, cursor: 'pointer', flexShrink: 0,
} as const;

/** Participants list with role labels; hosts get moderation controls per row.
 *  Renders from the 100ms store, so it works anywhere under HMSRoomProvider. */
export function PeoplePanel({ roles, isHost }: { roles: Roles; isHost: boolean }) {
  const actions = useHMSActions();
  const peers = useHMSStore(selectPeers) as Peer[];

  const hosts = peers.filter((p) => p.roleName === roles.host);
  const stage = peers.filter((p) => p.roleName === roles.stage);
  const viewers = peers.filter((p) => p.roleName === roles.viewer);

  if (peers.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--sw-stone-600)', fontSize: 12.5, padding: 24 }}>
        No one connected yet — the list fills in once video connects.
      </div>
    );
  }

  function row(p: Peer, badge: ReactNode, controls: ReactNode) {
    return (
      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--sw-line-mist)' }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--sw-mist-100)', color: 'var(--sw-forest-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {p.name?.[0]?.toUpperCase() ?? '?'}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--sw-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name}{p.isLocal ? ' (You)' : ''}{p.isHandRaised ? ' ✋' : ''}
        </span>
        {badge}
        {controls}
      </div>
    );
  }

  const section = (title: string, count: number) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--sw-stone-600)', margin: '14px 0 2px' }}>
      {title} · {count}
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
      {section('Hosts', hosts.length)}
      {hosts.map((p) => row(
        p,
        <span style={chip('var(--sw-forest-900)', '#fff')}>★ Host</span>,
        isHost && !p.isLocal ? (
          <button style={miniBtn} title="Remove co-host (back to panelist)"
            onClick={() => actions.changeRoleOfPeer(p.id, roles.stage, true).catch(() => undefined)}>Demote</button>
        ) : null,
      ))}

      {section('On stage', stage.length)}
      {stage.length === 0 && <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', padding: '6px 0' }}>No one on stage.</div>}
      {stage.map((p) => row(
        p,
        <span style={chip('var(--sw-gold-100)', 'var(--sw-clay-600)')}>On stage</span>,
        isHost && !p.isLocal ? (
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {p.audioTrack && (
              <button style={miniBtn} title="Mute their mic"
                onClick={() => actions.setRemoteTrackEnabled(p.audioTrack as string, false).catch(() => undefined)}>Mute</button>
            )}
            <button style={miniBtn} title="Move back to audience"
              onClick={() => actions.changeRoleOfPeer(p.id, roles.viewer, true).catch(() => undefined)}>↓ Stage</button>
            <button style={{ ...miniBtn, color: 'var(--sw-error)' }} title="Remove from the class"
              onClick={() => { if (window.confirm(`Remove ${p.name} from the class?`)) actions.removePeer(p.id, 'Removed by the host').catch(() => undefined); }}>✕</button>
          </span>
        ) : null,
      ))}

      {section('Watching', viewers.length)}
      {viewers.length === 0 && <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', padding: '6px 0' }}>No viewers yet.</div>}
      {viewers.slice(0, MAX_VIEWERS_SHOWN).map((p) => row(
        p,
        <span style={chip('var(--sw-line-soft)', 'var(--sw-stone-600)')}>Watching</span>,
        isHost && !p.isLocal ? (
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {p.isHandRaised && (
              <button style={{ ...miniBtn, background: 'var(--sw-moss-600)', border: '1px solid var(--sw-moss-600)', color: '#fff' }} title="Allow to speak"
                onClick={() => { actions.changeRoleOfPeer(p.id, roles.stage, true).catch(() => undefined); actions.lowerRemotePeerHand(p.id).catch(() => undefined); }}>Allow</button>
            )}
            <button style={{ ...miniBtn, color: 'var(--sw-error)' }} title="Remove from the class"
              onClick={() => { if (window.confirm(`Remove ${p.name} from the class?`)) actions.removePeer(p.id, 'Removed by the host').catch(() => undefined); }}>✕</button>
          </span>
        ) : null,
      ))}
      {viewers.length > MAX_VIEWERS_SHOWN && (
        <div style={{ fontSize: 12, color: 'var(--sw-stone-600)', padding: '8px 0' }}>…and {viewers.length - MAX_VIEWERS_SHOWN} more watching</div>
      )}
    </div>
  );
}
