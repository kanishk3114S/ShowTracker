import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clapperboard, Compass, Library as LibraryIcon, PlayCircle, Star, Tv } from 'lucide-react';
import Container from '../../components/layout/Container';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Reveal, Stagger } from '../../components/ui/motion';
import { Skeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/dashboard/StatCard';
import ContinueWatchingShelf from '../../components/dashboard/ContinueWatchingShelf';
import RecentlyUpdatedGrid from '../../components/dashboard/RecentlyUpdatedGrid';
import QuickDiscovery from '../../components/dashboard/QuickDiscovery';
import EmptyState from '../../components/media/EmptyState';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import { getLibraryStats, getContinueWatching, getRecentlyUpdated } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { useAuth } from '../../hooks/useAuth';

function SectionHeading({ title, to, linkLabel }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{title}</h2>
      {to && (
        <Link to={to} className="text-sm font-medium text-copper transition hover:text-copper-hover">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="space-y-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-video w-[19rem] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const stats = useApiResource((signal) => getLibraryStats(signal), []);
  const shelf = useApiResource((signal) => getContinueWatching(signal), []);
  const recent = useApiResource((signal) => getRecentlyUpdated(signal), []);

  const fullName = profile?.display_name || user?.user_metadata?.full_name || profile?.username || 'there';
  const firstName = fullName.split(' ')[0];
  const s = stats.data;
  const loading = (stats.loading && !s) || (shelf.loading && !shelf.data) || (recent.loading && !recent.data);
  const error = stats.error || shelf.error || recent.error;
  const reloadAll = () => {
    stats.reload();
    shelf.reload();
    recent.reload();
  };

  return (
    <Container className="py-8 sm:py-10">
      {/* Welcome hero */}
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-ink-edge bg-ink-surface p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-copper/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-copper">Dashboard</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-fg sm:text-4xl">Welcome back, {firstName}</h1>
              <p className="mt-2 text-sm text-fg-muted">
                {s
                  ? s.totalItems > 0
                    ? `${s.totalItems} ${s.totalItems === 1 ? 'title' : 'titles'} · ${s.episodesWatched.toLocaleString()} ${s.episodesWatched === 1 ? 'episode' : 'episodes'} watched`
                    : 'Your library is empty. Let us find your next favorite.'
                  : 'Loading your library…'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button as={Link} to="/explore" variant="primary" leftIcon={Compass}>
                Explore titles
              </Button>
              <Button as={Link} to="/library" variant="secondary" leftIcon={LibraryIcon}>
                My Library
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-10 space-y-12">
        {loading ? (
          <DashboardSkeleton />
        ) : error && !s ? (
          <ProviderErrorState error={error} onRetry={reloadAll} />
        ) : (
          <>
            {/* Live stats */}
            <section aria-label="Your statistics">
              <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-5" gap={0.06}>
                <StatCard label="Library" value={s.totalItems} icon={LibraryIcon} hint="titles saved">
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="indigo">{s.byType.ANIME} Anime</Badge>
                    <Badge tone="green">{s.byType.TV} TV</Badge>
                    <Badge tone="copper">{s.byType.MOVIE} Movies</Badge>
                  </div>
                </StatCard>
                <StatCard label="Episodes watched" value={s.episodesWatched.toLocaleString()} icon={Tv} hint="across anime and TV" />
                <StatCard label="Completed" value={s.completed} icon={CheckCircle2} hint="finished titles" />
                <StatCard label="Watching" value={s.watching} icon={PlayCircle} hint="in progress right now" />
                <StatCard
                  label="Average rating"
                  value={s.averageRating === null ? '—' : s.averageRating.toFixed(1)}
                  icon={Star}
                  hint={s.ratedCount > 0 ? `from ${s.ratedCount} rated ${s.ratedCount === 1 ? 'title' : 'titles'}` : 'rate a title to see this'}
                />
              </Stagger>
            </section>

            {s.totalItems === 0 ? (
              <EmptyState
                icon={Clapperboard}
                title="Start your library"
                message="Find an anime, movie or series you love, add it to your library, and your stats and progress will appear here."
                action={
                  <Button as={Link} to="/explore" variant="primary" leftIcon={Compass}>
                    Explore titles
                  </Button>
                }
              />
            ) : (
              <>
                <section aria-label="Continue watching">
                  <SectionHeading title="Continue watching" to="/library?status=WATCHING" linkLabel="View all" />
                  {shelf.data?.length ? (
                    <ContinueWatchingShelf items={shelf.data} />
                  ) : (
                    <p className="rounded-xl border border-dashed border-ink-edge px-4 py-8 text-center text-sm text-fg-muted">
                      Nothing in progress. Set a title to <span className="text-fg">Watching</span> and it will show up here.
                    </p>
                  )}
                </section>

                {recent.data?.length > 0 && (
                  <section aria-label="Recently updated">
                    <SectionHeading title="Recently updated" to="/library" linkLabel="Open library" />
                    <RecentlyUpdatedGrid items={recent.data} />
                  </section>
                )}
              </>
            )}

            <QuickDiscovery />
          </>
        )}
      </div>
    </Container>
  );
}
