import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Compass, Library as LibraryIcon } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import LibraryCard from '../../components/library/LibraryCard';
import LibraryFilters, { SORTS } from '../../components/library/LibraryFilters';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import Button from '../../components/ui/Button';
import { PosterGridSkeleton, POSTER_GRID } from '../../components/ui/Skeleton';
import { Stagger, StaggerItem } from '../../components/ui/motion';
import { STATUS_ORDER } from '../../components/library/libraryConstants';
import { getMyLibrary, getLibraryStats } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';

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

  const { data, error, loading, reload } = useApiResource(
    (signal) => getMyLibrary({ status, mediaType, sort, order }, signal),
    [status, mediaType, sort, order]
  );
  const stats = useApiResource((signal) => getLibraryStats(signal), []);
  const counts = useMemo(() => (stats.data ? { total: stats.data.totalItems, byStatus: stats.data.byStatus } : null), [stats.data]);

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
            key={`${status}|${mediaType}|${sortKey}`}
            className={`${POSTER_GRID} transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}
            gap={0.03}
          >
            {entries.map((entry) => (
              <StaggerItem key={entry.id}>
                <LibraryCard entry={entry} onChanged={onChanged} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </Container>
  );
}
