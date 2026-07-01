import { useEffect, useRef, useState } from 'react';
import {
  useHMSActions, useHMSStore, useVideo,
  selectIsConnectedToRoom, selectPeers, selectIsLocalAudioEnabled, selectIsLocalVideoEnabled,
} from '@100mslive/react-sdk';

/** Just the join bits VideoRoom needs — shared by learner (/live) and host (/teach). */
export interface RoomToken { videoEnabled: boolean; token: string | null }

/** Minimal shape we use from an HMS peer (structurally a subset of HMSPeer). */
interface Peer { id: string; name: string; isLocal: boolean; videoTrack?: string }

function Tile({ peer }: { peer: Peer }) {
  const { videoRef } = useVideo({ trackId: peer.videoTrack });
  return (
    <div style={{ position: 'relative', background: '#0d1f1a', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 10' }}>
      {peer.videoTrack ? (
        <video ref={videoRef} autoPlay muted={peer.isLocal} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: peer.isLocal ? 'scaleX(-1)' : undefined }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 28, fontWeight: 600 }}>
          {peer.name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '2px 8px' }}>
        {peer.name}{peer.isLocal ? ' (You)' : ''}
      </div>
    </div>
  );
}

const ctrlBtn = (active: boolean) => ({
  height: 42, minWidth: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.22)',
  background: active ? 'rgba(255,255,255,0.12)' : '#b5443a', color: '#fff', fontFamily: 'var(--font-body)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
} as const);

export function VideoRoom({ room, userName, onLeave }: { room: RoomToken; userName: string; onLeave: () => void }) {
  const actions = useHMSActions();
  const connected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers) as Peer[];
  const audioOn = useHMSStore(selectIsLocalAudioEnabled);
  const videoOn = useHMSStore(selectIsLocalVideoEnabled);
  const joinedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  // Join once when we have a token; always leave on unmount.
  useEffect(() => {
    if (room.videoEnabled && room.token && !joinedRef.current) {
      joinedRef.current = true;
      setError(null);
      actions.join({ authToken: room.token, userName }).catch((e: unknown) => {
        joinedRef.current = false;
        setError((e as Error)?.message || 'Could not connect to the video room.');
      });
    }
    return () => { actions.leave().catch(() => undefined); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.token]);

  // If we're not connected within 15s (and no explicit error), show a hint.
  useEffect(() => {
    if (connected || error) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, [connected, error]);

  async function leave() {
    await actions.leave().catch(() => undefined);
    onLeave();
  }

  // Video not configured yet (no 100ms keys) — clear, friendly placeholder.
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
            <div style={{ fontSize: 11.5, maxWidth: 420, color: 'rgba(255,255,255,0.5)' }}>
              If this mentions a role, the 100ms template’s role names don’t match — set HMS_HOST_ROLE / HMS_GUEST_ROLE. Otherwise check the keys or camera permission.
            </div>
            <button onClick={onLeave} style={{ marginTop: 8, ...ctrlBtn(true) }}>Leave</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14 }}>Connecting to the class…</div>
            {slow && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', maxWidth: 380 }}>Taking longer than usual — check that camera/mic permission is allowed, or try Leave and rejoin.</div>}
            {slow && <button onClick={onLeave} style={{ marginTop: 6, ...ctrlBtn(true) }}>Leave</button>}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ flex: 1, display: 'grid', gap: 10, gridTemplateColumns: `repeat(${peers.length <= 1 ? 1 : peers.length <= 4 ? 2 : 3}, 1fr)`, alignContent: 'start' }}>
        {peers.map((p) => <Tile key={p.id} peer={p} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '4px 0' }}>
        <button onClick={() => actions.setLocalAudioEnabled(!audioOn)} style={ctrlBtn(audioOn)}>{audioOn ? '🎙 Mute' : '🔇 Unmute'}</button>
        <button onClick={() => actions.setLocalVideoEnabled(!videoOn)} style={ctrlBtn(videoOn)}>{videoOn ? '📹 Stop video' : '🚫 Start video'}</button>
        <button onClick={() => void leave()} style={ctrlBtn(false)}>Leave</button>
      </div>
    </div>
  );
}
