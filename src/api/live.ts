import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

const DEFAULT_INTERVAL = 30_000;

/**
 * Data hook with built-in live refresh:
 *  - silent background polling (default every 30s; tune per-resource)
 *  - a refetch whenever the browser tab regains focus / becomes visible
 *
 * The `loading` flag only flips on the first load and on manual reload(), so
 * background refreshes update the data without flickering the screen. This is
 * why no screen needs a manual refresh anymore.
 */
export function useLiveResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
  intervalMs: number = DEFAULT_INTERVAL,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Always call the latest fetcher (it may close over changing params).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback((silent: boolean) => {
    if (!silent) setLoading(true);
    return fetcherRef.current()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => { if (!silent) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Initial load + refetch when deps change.
  useEffect(() => { void load(false); }, [load]);

  // Silent polling + refetch on tab focus (only while the tab is visible).
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(true); };
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load, intervalMs]);

  const reload = useCallback(() => load(false), [load]);
  return { data, loading, error, reload };
}
