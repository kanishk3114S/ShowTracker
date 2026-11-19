import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import MediaGroupSection from '../../components/media/MediaGroupSection';
import FeaturedHero from '../../components/media/FeaturedHero';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import Pagination from '../../components/media/Pagination';
import Tabs from '../../components/ui/Tabs';
import { PosterGridSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';

import { useDocumentHead } from '../../hooks/useDocumentHead';
const TYPE_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'TV', label: 'TV Shows' },
  { value: 'MOVIE', label: 'Movies' }
];
const WINDOW_TABS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' }
];
const PREVIEW_COUNT = 12;

export default function Trending() {
  useDocumentHead({ title: 'Trending Movies, Series & Anime Right Now — ShowTracker', description: 'What everyone is watching this week: trending anime, movies and TV series.' });
  const [params, setParams] = useSearchParams();
  const type = ['ALL', 'ANIME', 'MOVIE', 'TV'].includes(params.get('type')) ? params.get('type') : 'ALL';
  const windowValue = params.get('window') === 'day' ? 'day' : 'week';
  const page = type === 'ALL' ? 1 : Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const update = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
      },
      { replace: true }
    );

  const { data, error, loading, reload } = useResource(R.trending({ type, window: windowValue, page }));
  const groups = data?.groups ?? [];
  const single = type !== 'ALL';

  // Editorial hero: the top title that has real wide artwork (prefers TMDB backdrops)
  const hero = groups
    .filter((g) => !g.error)
    .flatMap((g) => g.results.slice(0, 3).map((m) => ({ m, label: g.label })))
    .find((x) => x.m.backdropUrl && page === 1) ??
    groups.filter((g) => !g.error && page === 1).flatMap((g) => g.results.slice(0, 1).map((m) => ({ m, label: g.label })))[0];

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        icon={Flame}
        title="Trending"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Trending' }]}
        description="Movies and TV follow TMDB’s daily or weekly trending lists. Anime uses AniList’s own trending ranking, which has no day or week setting."
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Tabs name="trending-type" ariaLabel="Media category" tabs={TYPE_TABS} value={type} onChange={(v) => update({ type: v === 'ALL' ? '' : v, page: '' })} />
        <Tabs
          name="trending-window"
          ariaLabel="Time window for movies and TV"
          tabs={WINDOW_TABS}
          value={windowValue}
          onChange={(v) => update({ window: v === 'week' ? '' : v, page: '' })}
        />
      </div>

      {loading && !data ? (
        <div className="space-y-10">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <PosterGridSkeleton />
        </div>
      ) : error && !data ? (
        <ProviderErrorState error={error} onRetry={reload} />
      ) : (
        <div className={`space-y-12 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
          {hero && <FeaturedHero media={hero.m} label={hero.label} />}
          {groups.map((group) => (
            <MediaGroupSection
              key={`${group.mediaType}|${windowValue}|${page}`}
              group={group}
              showHeading
              limit={single ? undefined : PREVIEW_COUNT}
              onRetry={reload}
            />
          ))}
          {single && groups[0] && !groups[0].error && (
            <Pagination
              page={page}
              totalPages={groups[0].pagination.totalPages}
              hasNextPage={groups[0].pagination.hasNextPage}
              disabled={loading}
              onChange={(p) => {
                update({ page: p > 1 ? String(p) : '' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </div>
      )}
    </Container>
  );
}
