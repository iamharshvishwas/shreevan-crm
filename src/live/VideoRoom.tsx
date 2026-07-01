import { useEffect, useRef, useState } from 'react';
import {
  useHMSActions, useHMSStore, useVideo, useScreenShare,
  selectIsConnectedToRoom, selectPeers, selectPeerCount, selectDominantSpeaker,
  selectLocalPeer, selectLocalPeerRoleName, selectIsLocalAudioEnabled, selectIsLocalVideoEnabled,
  selectPeerScreenSharing, selectScreenShareByPeerID,
} from '@100mslive/react-sdk';
import type { Roles } from './roomTypes';

/** Just the join bits VideoRoom needs — shared by learner (/live) and host (/teach). */
export interface RoomToken { videoEnabled: boolean; token: string | null }

/** Minimal shape we use from an HMS peer (structurally a subset of HMSPeer). */
interface Peer { id: string; name: string; isLocal: boolean; roleName?: string; videoTrack?: string; isHandRaised: boolean }

const TILES_PER_PAGE = 9;

function Tile({ peer, highlight, big }: { peer: Peer; highlight?: boolean; big?: boolean }) {
  const { videoRef } = useVideo({ trackId: peer.videoTrack });
  return (
    <div style={{ position: 'relative', background: '#0d1f1a', borderRadius: 12, overflow: 'hidden', aspectRatio: big ? undefined : '16 / 10', height: big ? '100%' : undefined, width: '100%', outline: highlight ? '3px solid var(--sw-moss-600)' : 'none' }}>
      {peer.videoTrack ? (
        <video ref={videoRef} autoPlay muted={peer.isLocal} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: peer.isLocal ? 'scaleX(-1)' : undefined }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: big ? 48 : 28, fontWeight: 600 }}>
          {peer.name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '2px 8px' }}>
        {peer.name}{peer.isLocal ? ' (You)' : ''}{peer.isHandRaised ? ' ✋' : ''}
      </div>
    </div>
  );
}

function ScreenTile({ trackId, label }: { trackId: string; label?: string }) {
  const { videoRef } = useVideo({ trackId });
  return (
    <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', height: '100%', width: '100%' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      {label && <div style={{ position: 'absolute', left: 8, top: 8, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 8px' }}>🖥 {label}</div>}
    </div>
  );
}

const ctrlBtn = (active: boolean) => ({
  height: 42, minWidth: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.22)',
  background: active ? 'rgba(255,255,255,0.12)' : '#b5443a', color: '#fff', fontFamily: 'var(--font-body)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const);

const lightBtn = {
  height: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const;

export function VideoRoom({ room, roles, userName, onLeave }: { room: RoomToken; roles: Roles; userName: string; onLeave: () => void }) {
  const actions = useHMSActions();
  const connected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers) as Peer[];
  const peerCount = useHMSStore(selectPeerCount);
  const dominant = useHMSStore(selectDominantSpeaker) as Peer | null;
  const localPeer = useHMSStore(selectLocalPeer) as Peer | undefined;
  const myRole = useHMSStore(selectLocalPeerRoleName);
  const audioOn = useHMSStore(selectIsLocalAudioEnabled);
  const videoOn = useHMSStore(selectIsLocalVideoEnabled);
  const { amIScreenSharing, toggleScreenShare } = useScreenShare();
  const screenPeer = useHMSStore(selectPeerScreenSharing) as Peer | undefined;
  const screenTrack = useHMSStore(selectScreenShareByPeerID(screenPeer?.id ?? '')) as { id?: string } | undefined;
  const screenTrackId = screenTrack?.id;
  const joinedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (room.videoEnabled && room.token && !joinedRef.current) {
      joinedRef.current = true;
      setError(null);
      actions.join({ authToken: room.token, userName, settings: { isAudioMuted: true, isVideoMuted: true } }).catch((e: unknown) => {
        joinedRef.current = false;
        setError((e as Error)?.message || 'Could not connect to the video room.');
      });
    }
    return () => { actions.leave().catch(() => undefined); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.token]);

  useEffect(() => {
    if (connected || error) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, [connected, error]);

  async function leave() { await actions.leave().catch(() => undefined); onLeave(); }

  if (!room.videoEnabled) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0d1f1a', borderRadius: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40 }}>🎥</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: '#fff' }}>Video will activate shortly</div>
        <div style={{ fontSize: 13, maxWidth: 360 }}>The class is live. Video turns on as soon as the 100ms keys are configured — no rejoining needed.</div>
        <button onClick={onLeave} style={{ marginTop: 10, ...ctrlBtn(true) }}>Leave</button>
      </div>
    );
  }
  if (!connected) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0d1f1a', borderRadius: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', padding: 24 }}>
        {error ? (
          <>
            <div style={{ fontSize: 34 }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: '#fff' }}>Couldn’t connect to the video</div>
            <div style={{ fontSize: 12.5, maxWidth: 420, color: 'rgba(255,255,255,0.75)' }}>{error}</div>
            <button onClick={onLeave} style={{ marginTop: 8, ...ctrlBtn(true) }}>Leave</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14 }}>Connecting to the class…</div>
            {slow && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', maxWidth: 380 }}>Taking longer than usual — check camera/mic permission, or Leave and rejoin.</div>}
            {slow && <button onClick={onLeave} style={{ marginTop: 6, ...ctrlBtn(true) }}>Leave</button>}
          </>
        )}
      </div>
    );
  }

  // ---- connected ----
  const isHost = myRole === roles.host;
  const onStage = myRole === roles.stage;
  const canPublish = isHost || onStage;
  const stagePeers = peers.filter((p) => p.roleName === roles.host || p.roleName === roles.stage);
  const raisedHands = peers.filter((p) => p.roleName === roles.viewer && p.isHandRaised);
  const handRaised = !!localPeer?.isHandRaised;

  // Shared "main stage": a live screen share takes over everywhere; otherwise
  // host/on-stage see a paginated camera gallery and viewers see the host.
  const pages = Math.max(1, Math.ceil(stagePeers.length / TILES_PER_PAGE));
  const pageSafe = Math.min(page, pages - 1);
  const shown = stagePeers.slice(pageSafe * TILES_PER_PAGE, pageSafe * TILES_PER_PAGE + TILES_PER_PAGE);
  const cols = shown.length <= 1 ? 1 : shown.length <= 4 ? 2 : 3;
  const spotlight = (dominant && stagePeers.find((p) => p.id === dominant.id))
    ?? stagePeers.find((p) => p.roleName === roles.host)
    ?? stagePeers[0];

  let mainArea;
  if (screenTrackId) {
    // Screen share on → big screen + a small camera strip.
    mainArea = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}><ScreenTile trackId={screenTrackId} label={`${screenPeer?.name ?? 'Host'} is sharing`} /></div>
        <div style={{ display: 'flex', gap: 8, height: 92, overflowX: 'auto' }}>
          {stagePeers.map((p) => (
            <div key={p.id} style={{ width: 150, flexShrink: 0 }}><Tile peer={p} highlight={dominant?.id === p.id} /></div>
          ))}
        </div>
      </div>
    );
  } else if (canPublish) {
    mainArea = (
      <>
        <div style={{ flex: 1, display: 'grid', gap: 10, gridTemplateColumns: `repeat(${cols}, 1fr)`, alignContent: 'start', minHeight: 0 }}>
          {shown.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <Tile peer={p} highlight={dominant?.id === p.id} />
              {isHost && !p.isLocal && p.roleName === roles.stage && (
                <button onClick={() => actions.changeRoleOfPeer(p.id, roles.viewer, true).catch(() => undefined)} title="Remove from stage"
                  style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', fontSize: 12.5 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={pageSafe === 0} style={{ ...lightBtn, height: 30, opacity: pageSafe === 0 ? 0.5 : 1 }}>‹</button>
            <span>{pageSafe + 1} / {pages} · {peerCount} in class</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={pageSafe >= pages - 1} style={{ ...lightBtn, height: 30, opacity: pageSafe >= pages - 1 ? 0.5 : 1 }}>›</button>
          </div>
        )}
      </>
    );
  } else {
    mainArea = spotlight
      ? <div style={{ flex: 1, minHeight: 0 }}><Tile peer={spotlight} big /></div>
      : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1f1a', borderRadius: 12, color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Waiting for the host to start the video…</div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {isHost && raisedHands.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(212,163,74,0.15)', border: '1px solid rgba(212,163,74,0.4)', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#f0d9a8' }}>✋ {raisedHands.length} raised hand{raisedHands.length > 1 ? 's' : ''}:</span>
          {raisedHands.slice(0, 6).map((p) => (
            <button key={p.id} onClick={() => { actions.changeRoleOfPeer(p.id, roles.stage, true).catch(() => undefined); actions.lowerRemotePeerHand(p.id).catch(() => undefined); }}
              style={{ height: 28, padding: '0 12px', borderRadius: 999, border: '1px solid var(--sw-moss-600)', background: 'var(--sw-moss-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {p.name} → Allow to speak
            </button>
          ))}
        </div>
      )}

      {mainArea}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '4px 0', flexWrap: 'wrap' }}>
        {canPublish ? (
          <>
            <button onClick={() => actions.setLocalAudioEnabled(!audioOn)} style={ctrlBtn(audioOn)}>{audioOn ? '🎙 Mute' : '🔇 Unmute'}</button>
            <button onClick={() => actions.setLocalVideoEnabled(!videoOn)} style={ctrlBtn(videoOn)}>{videoOn ? '📹 Stop video' : '🚫 Start video'}</button>
            {toggleScreenShare && (
              <button onClick={() => toggleScreenShare().catch(() => undefined)} style={amIScreenSharing ? ctrlBtn(false) : lightBtn}>
                {amIScreenSharing ? '🖥 Stop share' : '🖥 Share screen'}
              </button>
            )}
            {onStage && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>You’re on stage</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>👁 Watching · {peerCount} in class</span>
            {handRaised
              ? <button onClick={() => actions.lowerLocalPeerHand()} style={{ ...lightBtn, background: 'rgba(212,163,74,0.3)' }}>✋ Hand raised · lower</button>
              : <button onClick={() => actions.raiseLocalPeerHand()} style={lightBtn}>✋ Raise hand to speak</button>}
          </>
        )}
        <button onClick={() => void leave()} style={ctrlBtn(false)}>Leave</button>
      </div>
    </div>
  );
}
