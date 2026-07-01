import { useEffect, useState } from 'react';

/** True when the viewport is narrower than `maxWidth`px (phone / small tablet).
 *  Used to stack the class-room layout vertically instead of video + 320px panel. */
export function useIsNarrow(maxWidth = 860): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => window.matchMedia(`(max-width: ${maxWidth}px)`).matches);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);

  return narrow;
}
