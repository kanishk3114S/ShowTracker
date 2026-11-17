import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import SearchBar from '../../components/media/SearchBar';
import GenreFilter from '../../components/media/GenreFilter';
import MediaGroupSection from '../../components/media/MediaGroupSection';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import Pagination from '../../components/media/Pagination';
import Tabs from '../../components/ui/Tabs';
import { PosterGridSkeleton } from '../../components/ui/Skeleton';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { useDebounce } from '../../hooks/useDebounce';

const MIN_QUERY = 2;
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1959 + 1 }, (_, i) => THIS_YEAR + 1 - i);
const TYPE_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'TV', label: 'TV Shows' },
  { value: 'MOVIE', label: 'Movies' }
];

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const type = ['ALL', 'ANIME', 'MOVIE', 'TV'].includes(params.get('type')) ? params.get('type') : 'ALL';
  const q = params.get('q') || '';
  const genreParam = params.get('genre') || '';
  const genres = useMemo(() => genreParam.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 5), [genreParam]);
  const year = params.get('year') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  // The input updates instantly; the URL (and therefore the request) follows after a pause in typing.
  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const appliedQuery = debounced.trim().length >= MIN_QUERY ? debounced.trim() : '';

  const update = (changes, { resetPage = true } = {}) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (appliedQuery !== q) update({ q: appliedQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery]);

  const { data, error, loading, reload } = useResource(R.search({ q, type, page, genre: genres, year }));
  const genreList = useResource(R.genres(type));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const pagination = useMemo(
    () => ({
      totalPages: Math.max(0, ...groups.map((g) => g.pagination?.totalPages ?? 0)),
      hasNextPage: groups.some((g) => g.pagination?.hasNextPage)
    }),
    [groups]
  );
  const allEmpty = groups.length > 0 && groups.every((g) => !g.error && g.results.length === 0);
  const genreIgnored = groups.some((g) => g.ignoredFilters?.includes('genre'));
  const tooShort = input.trim().length > 0 && input.trim().length < MIN_QUERY;

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        icon={Compass}
        title="Explore"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Explore' }]}
        description="Search anime, movies and TV shows, or browse what is popular right now."
      />

      <div className="space-y-4">
        <SearchBar value={input} onChange={setInput} placeholder="Search anime, movies and TV shows…" />
        {tooShort && <p className="text-xs text-fg-subtle">Type at least {MIN_QUERY} characters to search.</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            name="explore-type"
            ariaLabel="Media category"
            tabs={TYPE_TABS}
            value={type}
            onChange={(v) => update({ type: v === 'ALL' ? '' : v, genre: '' })}
          />
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Year
            <select
              value={year}
              onChange={(e) => update({ year: e.target.value })}
              className="h-9 rounded-lg border border-ink-edge bg-ink-surface px-2.5 text-sm text-fg outline-none focus:border-accent/60"
            >
              <option value="">Any</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <GenreFilter
          genres={genreList.data?.genres}
          value={genres}
          onChange={(list) => update({ genre: list.join(',') })}
          hint={
            genres.length > 0 && genreIgnored
              ? 'Movie and TV text searches cannot be filtered by genre. Clear the search text to filter them; anime results are still filtered.'
              : null
          }
        />
      </div>

      <div className="mt-8">
        <p className="mb-5 text-sm text-fg-muted" aria-live="polite">
          {q ? (
            <>
              Results for <span className="font-semibold text-fg">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            'Popular right now'
          )}
          {genres.length > 0 && <span className="text-fg-subtle"> · {genres.join(' or ')}</span>}
        </p>

        {loading && !data ? (
          <PosterGridSkeleton />
        ) : error && !data ? (
          <ProviderErrorState error={error} onRetry={reload} />
        ) : allEmpty ? (
          <EmptyState
            title={q ? `No titles found for “${q}”` : 'No titles match these filters'}
            message="Try a different spelling, another category, or clear the genre and year filters."
          />
        ) : (
          <div className={`space-y-12 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {groups.map((group) => (
              <MediaGroupSection
                key={`${group.mediaType}|${q}|${page}|${genreParam}|${year}`}
                group={group}
                showHeading={type === 'ALL'}
                onRetry={reload}
              />
            ))}
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              hasNextPage={pagination.hasNextPage}
              disabled={loading}
              onChange={(p) => update({ page: p > 1 ? String(p) : '' }, { resetPage: false })}
            />
          </div>
        )}
      </div>
    </Container>
  );
}
