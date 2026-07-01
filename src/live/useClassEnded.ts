import { useEffect, useState } from 'react';

/** Polls the class status while inside a room; true once the host has ended it. */
export function useClassEnded(classId: string, getStatus: (id: string) => Promise<{ status: string }>): boolean {
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const { status } = await getStatus(classId);
        if (live && status === 'ENDED') setEnded(true);
      } catch {
        // transient network hiccup — next poll recovers
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => { live = false; clearInterval(t); };
  }, [classId, getStatus]);

  return ended;
}
