import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clapperboard, Compass, Library as LibraryIcon, PlayCircle, Star, Tv } from 'lucide-react';
import Container from '../../components/layout/Container';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { Reveal, Stagger } from '../../components/ui/motion';
import GhostMark from '../../components/cinema/GhostMark';
import { Skeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/dashboard/StatCard';
import ContinueWatchingShelf from '../../components/dashboard/ContinueWatchingShelf';
import RecentlyUpdatedGrid from '../../components/dashboard/RecentlyUpdatedGrid';
import QuickDiscovery from '../../components/dashboard/QuickDiscovery';
import EmptyState from '../../components/media/EmptyState';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { useAuth } from '../../hooks/useAuth';

function SectionHeading({ title, subtitle, to, linkLabel }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
          <span className="h-5 w-1 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h2>
        {subtitle && <p className="mt-1 pl-[14px] text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="text-sm font-semibold text-accent transition hover:text-accent-hover">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-fg-muted">
      {children}
    </span>
  );
}

function TypeChip({ children }) {
  return <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{children}</span>;
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="space-y-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-video w-[19rem] shrink-0 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const stats = useResource(R.stats());
  const shelf = useResource(R.continueWatching());
  const recent = useResource(R.recentlyUpdated());

  const fullName = profile?.display_name || user?.user_metadata?.full_name || profile?.username || 'there';
  const firstName = fullName.split(' ')[0];
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
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
      {/* Welcome banner */}
      <Reveal>
        <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="bg-dots mask-radial pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.12),transparent_70%)]" aria-hidden="true" />
          <GhostMark text="『記録』" position="right" className="!right-6" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <Avatar src={avatarUrl} name={fullName} size="xl" className="!h-16 !w-16 border-2 border-white/15 sm:!h-20 sm:!w-20" />
              <div>
                <p className="text-sm font-semibold text-accent">Dashboard</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Welcome back, {firstName}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s ? (
                    <>
                      <Chip>
                        <LibraryIcon className="h-3 w-3" aria-hidden="true" /> {s.totalItems} {s.totalItems === 1 ? 'title' : 'titles'}
                      </Chip>
                      <Chip>
                        <Tv className="h-3 w-3" aria-hidden="true" /> {s.episodesWatched.toLocaleString()} episodes watched
                      </Chip>
                      {s.watching > 0 && (
                        <Chip>
                          <PlayCircle className="h-3 w-3" aria-hidden="true" /> {s.watching} in progress
                        </Chip>
                      )}
                    </>
                  ) : (
                    <Chip>Loading your library…</Chip>
                  )}
                </div>
              </div>
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

      <div className="mt-10 space-y-14">
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
                    <TypeChip>{s.byType.ANIME} Anime</TypeChip>
                    <TypeChip>{s.byType.TV} TV</TypeChip>
                    <TypeChip>{s.byType.MOVIE} Movies</TypeChip>
                  </div>
                </StatCard>
                <StatCard label="Episodes watched" value={s.episodesWatched} icon={Tv} hint="across anime and TV" />
                <StatCard label="Completed" value={s.completed} icon={CheckCircle2} hint="finished titles" />
                <StatCard label="Watching" value={s.watching} icon={PlayCircle} hint="in progress right now" />
                <StatCard
                  label="Average rating"
                  value={s.averageRating === null ? '—' : s.averageRating}
                  decimals={1}
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
                  <SectionHeading title="Continue watching" subtitle="Pick up exactly where you left off." to="/library?status=WATCHING" linkLabel="View all" />
                  {shelf.data?.length ? (
                    <ContinueWatchingShelf items={shelf.data} onChanged={reloadAll} />
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-fg-muted">
                      Nothing in progress. Set a title to <span className="font-semibold text-fg">Watching</span> and it will show up here.
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
