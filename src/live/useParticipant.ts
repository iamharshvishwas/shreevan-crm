import { useEffect, useState } from 'react';
import { clearLiveToken, liveApi, liveToken, setLiveToken, type Participant } from './liveApi';

export function useParticipant() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState<boolean>(!!liveToken());

  // Restore session on load if a token exists.
  useEffect(() => {
    if (!liveToken()) return;
    let live = true;
    liveApi.me()
      .then((p) => { if (live) setParticipant(p); })
      .catch(() => { clearLiveToken(); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function signup(email: string, name: string, password: string) {
    const s = await liveApi.signup(email, name, password);
    setLiveToken(s.token);
    setParticipant(s.participant);
  }
  async function login(email: string, password: string) {
    const s = await liveApi.login(email, password);
    setLiveToken(s.token);
    setParticipant(s.participant);
  }
  function logout() {
    clearLiveToken();
    setParticipant(null);
  }

  return { participant, loading, signup, login, logout };
}

export type ParticipantStore = ReturnType<typeof useParticipant>;
