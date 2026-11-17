import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../services/api';

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
 * - The previous in-flight request is aborted, and a late response from an
 *   older request can never overwrite newer state (stale-response protection).
 * - Returns { data, error, loading, reload }.
 */
export function useApiResource(fetcher, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, error: null, loading: true }));

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const apiError = toApiError(err);
        if (apiError) setState({ data: null, error: apiError, loading: false });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
