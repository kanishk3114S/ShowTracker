import { useEffect, useState } from 'react';
import { getTrendingMedia } from '../services/api';

/**
 * Real trending artwork from TMDB / AniList (through our API) for the landing
 * collage and sign-in backdrop. Loaded once per page load and shared. If the
 * API is unavailable the list is simply empty and callers show a plain surface;
 * artwork is never invented.
 */
let cached = null;
let inflight = null;

function load() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getTrendingMedia({ type: 'ALL', window: 'week' })
      .then((data) => {
        // Round-robin across movies, anime and TV so any slice of the list is varied.
        const lists = ['MOVIE', 'ANIME', 'TV'].map((t) => (data.groups.find((g) => g.mediaType === t)?.results ?? []).filter((m) => m.posterUrl));
        const all = [];
        for (let i = 0; i < Math.max(...lists.map((l) => l.length), 0); i++) {
          lists.forEach((l) => l[i] && all.push(l[i]));
        }
        cached = {
          posters: all,
          backdrops: all.filter((m) => m.backdropUrl),
          groups: Object.fromEntries(data.groups.map((g) => [g.mediaType, g.results]))
        };
        return cached;
      })
      .catch(() => ({ posters: [], backdrops: [], groups: {} }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useTrendingArtwork() {
  const [state, setState] = useState(cached ?? { posters: [], backdrops: [], groups: {} });
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let alive = true;
    load().then((result) => {
      if (!alive) return;
      setState(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { ...state, loading };
}

export default useTrendingArtwork;
