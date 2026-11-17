import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MediaCard from '../media/MediaCard';
import { Skeleton } from '../ui/Skeleton';
import { useTrendingArtwork } from '../../hooks/useTrendingArtwork';

/** "Trending this week" strip that encourages browsing (real TMDB / AniList data). */
export default function QuickDiscovery() {
  const { posters, loading } = useTrendingArtwork();

  // Interleave anime / movies / TV so the strip is varied, not three blocks.
  const items = (() => {
    const byType = { ANIME: [], MOVIE: [], TV: [] };
    posters.forEach((m) => byType[m.mediaType]?.push(m));
    const out = [];
    for (let i = 0; out.length < 12 && i < 8; i++) {
      ['MOVIE', 'ANIME', 'TV'].forEach((t) => byType[t][i] && out.push(byType[t][i]));
    }
    return out.slice(0, 12);
  })();

  if (!loading && items.length === 0) return null;

  return (
    <section aria-label="Trending this week">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">Trending this week</h2>
          <p className="mt-1 text-sm text-fg-muted">Fresh picks from TMDB and AniList.</p>
        </div>
        <Link to="/trending" className="inline-flex items-center gap-1 text-sm font-medium text-copper transition hover:text-copper-hover">
          See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {loading
          ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="aspect-[2/3] w-36 shrink-0 rounded-xl sm:w-40" />)
          : items.map((m) => (
              <div key={`${m.provider}:${m.mediaType}:${m.externalId}`} className="w-36 shrink-0 sm:w-40">
                <MediaCard media={m} />
              </div>
            ))}
      </div>
    </section>
  );
}
