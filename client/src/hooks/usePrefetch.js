import { useEffect, useMemo, useRef } from 'react';
import { prefetchRoute } from '../routes/pages';
import { prefetchMediaDetails } from '../services/resources';

/**
 * Props to spread on a link/card so its destination starts loading before the click:
 * - mouse: after a short hover (so sweeping across a grid does not fire a request per card)
 * - keyboard focus and touch: immediately
 */
export function usePrefetchHandlers(onPrefetch, delayMs = 120) {
  const timer = useRef(null);
  return useMemo(
    () => ({
      onPointerEnter: (e) => {
        if (e.pointerType === 'touch') return;
        clearTimeout(timer.current);
        timer.current = setTimeout(onPrefetch, delayMs);
      },
      onPointerLeave: () => clearTimeout(timer.current),
      onFocus: onPrefetch,
      onTouchStart: onPrefetch
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delayMs]
  );
}

/** Prefetch handlers for a media card: the details page code and its data. */
export function useMediaPrefetch(media) {
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  });
  return usePrefetchHandlers(() => {
    const m = mediaRef.current;
    if (!m?.provider || !m?.externalId) return;
    prefetchRoute('/media/');
    prefetchMediaDetails(m);
  });
}
