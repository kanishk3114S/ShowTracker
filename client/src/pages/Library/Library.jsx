import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Compass, LayoutGrid, Library as LibraryIcon, List } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import LibraryCard, { LibraryRow } from '../../components/library/LibraryCard';
import LibraryFilters, { SORTS } from '../../components/library/LibraryFilters';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import Button from '../../components/ui/Button';
import { PosterGridSkeleton, POSTER_GRID } from '../../components/ui/Skeleton';
import { Stagger, StaggerItem } from '../../components/ui/motion';
import { STATUS_ORDER } from '../../components/library/libraryConstants';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';

const VIEW_KEY = 'showtracker.libraryView';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const EMPTY_COPY = {
  '': 'Your library is empty. Find something to watch and add it.',
  WATCHING: 'No titles in your Watching list yet.',
  COMPLETED: 'You have not completed anything yet.',
  PLAN_TO_WATCH: 'Nothing planned yet. Save titles you want to watch later.',
  ON_HOLD: 'Nothing on hold right now.',
  DROPPED: 'Nothing dropped.',
  REWATCHING: 'Nothing being rewatched right now.'
};

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

  const { data, error, loading, reload } = useResource(R.library({ status, mediaType, sort, order }));
  const stats = useResource(R.stats());
  const counts = useMemo(() => (stats.data ? { total: stats.data.totalItems, byStatus: stats.data.byStatus } : null), [stats.data]);

  const [view, setView] = useState(readView);
  const chooseView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* preference just won't persist */
    }
  };

  const entries = data ?? [];
  const filtered = Boolean(status || mediaType);
  const onChanged = () => {
    reload();
    stats.reload();
  };

  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        icon={LibraryIcon}
        title="My Library"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'My Library' }]}
        description="Everything you watch, in one place."
      />

      <div className="mb-4 flex justify-end">
        <div role="group" aria-label="Library view" className="glass-lite inline-flex rounded-xl p-1">
          {[
            ['grid', LayoutGrid, 'Grid view'],
            ['list', List, 'List view']
          ].map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              aria-label={label}
              onClick={() => chooseView(value)}
              className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${
                view === value ? 'bg-white/[0.1] text-fg ring-1 ring-white/15' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <LibraryFilters
        status={status}
        mediaType={mediaType}
        sortKey={sortKey}
        counts={counts}
        onChange={(changes) => update(changes)}
      />

      <div className="mt-8">
        {loading && !data ? (
          <PosterGridSkeleton count={10} />
        ) : error && !data ? (
          <ProviderErrorState error={error} onRetry={reload} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={LibraryIcon}
            title={filtered ? 'No titles here' : 'Your library is empty'}
            message={filtered ? (EMPTY_COPY[status] ?? 'No titles match these filters.') : EMPTY_COPY['']}
            action={
              <Button as={Link} to="/explore" variant="primary" leftIcon={Compass}>
                Explore titles
              </Button>
            }
          />
        ) : (
          <Stagger
            key={`${status}|${mediaType}|${sortKey}|${view}`}
            className={`${view === 'grid' ? POSTER_GRID : 'space-y-3'} transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}
            gap={0.03}
          >
            {entries.map((entry) => (
              <StaggerItem key={entry.id}>
                {view === 'grid' ? <LibraryCard entry={entry} onChanged={onChanged} /> : <LibraryRow entry={entry} onChanged={onChanged} />}
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </Container>
  );
}
