import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Library as LibraryIcon, Compass } from 'lucide-react';
import AppHeader from '../../components/layout/AppHeader';
import AppFooter from '../../components/layout/AppFooter';
import LibraryCard from '../../components/library/LibraryCard';
import MediaSkeleton, { GRID_CLASS } from '../../components/media/MediaSkeleton';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import { STATUS_META, STATUS_ORDER } from '../../components/library/libraryConstants';
import { getMyLibrary } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';

const STATUS_TABS = [{ value: '', label: 'All' }, ...['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'ON_HOLD', 'DROPPED', 'REWATCHING'].map((s) => ({ value: s, label: STATUS_META[s].label }))];
const TYPE_PILLS = [
  { value: '', label: 'All' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'TV', label: 'TV Shows' },
  { value: 'MOVIE', label: 'Movies' }
];
const SORTS = {
  recent: { label: 'Recently updated', sort: 'updated_at', order: 'desc' },
  title: { label: 'Title', sort: 'title', order: 'asc' },
  rating: { label: 'My rating', sort: 'rating', order: 'desc' },
  release: { label: 'Release date', sort: 'release_date', order: 'desc' }
};

const EMPTY_COPY = {
  '': 'Your library is empty. Find something to watch and add it.',
  WATCHING: 'No titles in your Watching list yet.',
  COMPLETED: 'You have not completed anything yet.',
  PLAN_TO_WATCH: 'Nothing planned yet. Save titles you want to watch later.',
  ON_HOLD: 'Nothing on hold.',
  DROPPED: 'Nothing dropped.',
  REWATCHING: 'Nothing being rewatched right now.'
};

const chip = (active) =>
  `rounded-full border px-3 py-1 text-xs font-medium transition ${
    active ? 'border-red-500 bg-red-600/20 text-red-200' : 'border-[#2A3245] bg-[#151922] text-[#9CA3AF] hover:border-[#3B455E] hover:text-white'
  }`;

export default function Library() {
  const [params, setParams] = useSearchParams();
  const status = STATUS_ORDER.includes(params.get('status')) ? params.get('status') : '';
  const mediaType = ['ANIME', 'MOVIE', 'TV'].includes(params.get('type')) ? params.get('type') : '';
  const sortKey = SORTS[params.get('sort')] ? params.get('sort') : 'recent';
  const { sort, order } = SORTS[sortKey];

  const update = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
      },
      { replace: true }
    );

  const { data, error, loading, reload } = useApiResource(
    (signal) => getMyLibrary({ status, mediaType, sort, order }, signal),
    [status, mediaType, sort, order]
  );
  const entries = data ?? [];
  const filtered = Boolean(status || mediaType);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6]">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <LibraryIcon className="h-6 w-6 text-red-500" /> My Library
            </h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">Everything you watch, in one place.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => update({ sort: e.target.value === 'recent' ? '' : e.target.value })}
              className="rounded-lg border border-[#2A3245] bg-[#151922] px-2.5 py-1.5 text-sm text-white outline-none focus:border-red-500"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                role="tab"
                type="button"
                aria-selected={status === tab.value}
                onClick={() => update({ status: tab.value })}
                className={chip(status === tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Media type" className="flex flex-wrap gap-1.5">
            {TYPE_PILLS.map((pill) => (
              <button
                key={pill.value || 'all'}
                type="button"
                aria-pressed={mediaType === pill.value}
                onClick={() => update({ type: pill.value })}
                className={chip(mediaType === pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {loading && !data ? (
            <MediaSkeleton count={10} />
          ) : error && !data ? (
            <ProviderErrorState error={error} onRetry={reload} />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={LibraryIcon}
              title={filtered ? 'No titles here' : 'Your library is empty'}
              message={filtered ? EMPTY_COPY[status] ?? 'No titles match these filters.' : EMPTY_COPY['']}
              action={
                <Link
                  to="/explore"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  <Compass className="h-4 w-4" /> Explore titles
                </Link>
              }
            />
          ) : (
            <div className={`${GRID_CLASS} transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
              {entries.map((entry) => (
                <LibraryCard key={entry.id} entry={entry} onChanged={reload} />
              ))}
            </div>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
