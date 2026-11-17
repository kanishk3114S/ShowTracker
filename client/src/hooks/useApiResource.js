import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../services/api';
import { readCache, writeCache, isFresh } from '../lib/queryCache';

/**
 * Debounce a fast-changing value (e.g. what the user is typing).
 */
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Loads data with `fetcher(signal)` whenever `deps` change.
 *
 * - The previous in-flight request is aborted, and a late response from an
 *   older request can never overwrite newer state (stale-response protection).
 * - With `cacheKey` it is stale-while-revalidate: cached data is returned on the
 *   very first render (no spinner), and refetched in the background unless it is
 *   younger than `staleMs`. If that background refresh fails, the cached data
 *   stays on screen instead of replacing it with an error.
 * - Returns { data, error, loading, reload }. `loading` is true during a
 *   background refresh too, so pages show skeletons only when `loading && !data`.
 */
export function useApiResource(fetcher, deps, { enabled = true, cacheKey, staleMs = 30_000 } = {}) {
  const [state, setState] = useState(() => {
    const hit = cacheKey && enabled ? readCache(cacheKey) : null;
    if (hit) return { data: hit.data, error: null, loading: !isFresh(hit, staleMs) };
    return { data: null, error: null, loading: enabled };
  });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  const forceRef = useRef(false);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const force = forceRef.current;
    forceRef.current = false;
    const hit = cacheKey ? readCache(cacheKey) : null;

    if (hit && !force && isFresh(hit, staleMs)) {
      setState({ data: hit.data, error: null, loading: false });
      return undefined;
    }
    if (hit) setState({ data: hit.data, error: null, loading: true });
    else setState((prev) => ({ ...prev, error: null, loading: true }));

    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (cacheKey) writeCache(cacheKey, data);
        setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const apiError = toApiError(err);
        if (!apiError) return;
        // keep showing what we have if a background refresh fails
        setState((prev) => (hit ? { data: prev.data, error: null, loading: false } : { data: null, error: apiError, loading: false }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce, cacheKey]);

  const reload = useCallback(() => {
    forceRef.current = true;
    setNonce((n) => n + 1);
  }, []);
  return { ...state, reload };
}

/** useApiResource for a resource definition from services/resources.js (cached, with its own freshness window). */
export function useResource(resource, { enabled = true } = {}) {
  return useApiResource(resource.fetch, [resource.key], { cacheKey: resource.key, staleMs: resource.staleMs, enabled });
}
