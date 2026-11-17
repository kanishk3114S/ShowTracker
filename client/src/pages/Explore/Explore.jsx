import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import AppHeader from '../../components/layout/AppHeader';
import AppFooter from '../../components/layout/AppFooter';
import SearchBar from '../../components/media/SearchBar';
import MediaCategoryTabs from '../../components/media/MediaCategoryTabs';
import GenreFilter from '../../components/media/GenreFilter';
import MediaSkeleton from '../../components/media/MediaSkeleton';
import MediaGroupSection from '../../components/media/MediaGroupSection';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import Pagination from '../../components/media/Pagination';
import { searchMedia, getMediaGenres } from '../../services/api';
import { useApiResource, useDebouncedValue } from '../../hooks/useApiResource';

const MIN_QUERY = 2;
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1959 + 1 }, (_, i) => THIS_YEAR + 1 - i);

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const type = ['ALL', 'ANIME', 'MOVIE', 'TV'].includes(params.get('type')) ? params.get('type') : 'ALL';
  const q = params.get('q') || '';
  const genre = params.get('genre') || '';
  const year = params.get('year') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  // The input updates instantly; the URL (and therefore the request) follows after a pause in typing.
  const [input, setInput] = useState(q);
  const debounced = useDebouncedValue(input, 350);
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

  const { data, error, loading, reload } = useApiResource(
    (signal) => searchMedia({ q, type, page, genre, year }, signal),
    [q, type, page, genre, year]
  );

  const genreList = useApiResource((signal) => getMediaGenres(type, signal), [type]);

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
  const showHeadings = type === 'ALL';
  const tooShort = input.trim().length > 0 && input.trim().length < MIN_QUERY;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6]">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Compass className="h-6 w-6 text-red-500" /> Explore
          </h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Search anime, movies and TV shows, or browse what is popular.</p>
        </div>

        <div className="space-y-4">
          <SearchBar value={input} onChange={setInput} placeholder="Search anime, movies and TV shows…" />
          {tooShort && <p className="text-xs text-[#9CA3AF]">Type at least {MIN_QUERY} characters to search.</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <MediaCategoryTabs value={type} onChange={(v) => update({ type: v === 'ALL' ? '' : v, genre: '' })} />
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              Year
              <select
                value={year}
                onChange={(e) => update({ year: e.target.value })}
                className="rounded-lg border border-[#2A3245] bg-[#151922] px-2.5 py-1.5 text-sm text-white outline-none focus:border-red-500"
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
            value={genre}
            onChange={(g) => update({ genre: g })}
            hint={
              genre && genreIgnored
                ? 'Movie and TV text searches cannot be filtered by genre. Clear the search text to filter them by genre; anime results are still filtered.'
                : null
            }
          />
        </div>

        <div className="mt-8">
          <p className="mb-4 text-sm text-[#9CA3AF]" aria-live="polite">
            {q ? (
              <>
                Results for <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span>
              </>
            ) : (
              'Popular right now'
            )}
          </p>

          {loading && !data ? (
            <MediaSkeleton />
          ) : error && !data ? (
            <ProviderErrorState error={error} onRetry={reload} />
          ) : allEmpty ? (
            <EmptyState
              title={q ? `No results for “${q}”` : 'No titles match these filters'}
              message="Try a different spelling, another category, or clear the genre and year filters."
            />
          ) : (
            <div className={`space-y-10 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
              {groups.map((group) => (
                <MediaGroupSection key={group.mediaType} group={group} showHeading={showHeadings} onRetry={reload} />
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
      </main>
      <AppFooter />
    </div>
  );
}
