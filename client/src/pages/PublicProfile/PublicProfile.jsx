import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Eye, Library as LibraryIcon, Lock, Pencil, ShieldCheck, Star, Tv } from 'lucide-react';
import Container from '../../components/layout/Container';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Skeleton, PosterGridSkeleton, POSTER_GRID } from '../../components/ui/Skeleton';
import { Reveal, Stagger, StaggerItem } from '../../components/ui/motion';
import PublicLibraryCard from '../../components/library/PublicLibraryCard';
import LibraryFilters, { SORTS } from '../../components/library/LibraryFilters';
import StatCard from '../../components/dashboard/StatCard';
import GhostMark from '../../components/cinema/GhostMark';
import EditProfileModal from '../../components/profile/EditProfileModal';
import { FeaturedShelf, MilestoneBadges, ViewingMix, pickFeatured } from '../../components/profile/ProfileShowcase';
import EmptyState from '../../components/media/EmptyState';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import { STATUS_ORDER } from '../../components/library/libraryConstants';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';

/** Calm "private" state: a sealed shield on a neutral card (reads as secure and deliberate, not broken). */
function PrivacyShield({ title, message, action }) {
  return (
    <div className="glass relative mx-auto max-w-xl overflow-hidden rounded-3xl px-6 py-14 text-center">
      <div className="bg-dots mask-radial pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
        <ShieldCheck className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="relative mt-5 text-xl font-bold text-white">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">{message}</p>
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

const joined = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

function ProfileSkeleton() {
  return (
    <Container className="py-8">
      <div role="status" aria-label="Loading profile" className="space-y-8">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <PosterGridSkeleton count={6} />
      </div>
    </Container>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
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

  const { data, error, loading, reload } = useResource(R.profile(username, { status, mediaType, sort, order }));

  const counts = useMemo(() => (data?.stats ? { total: data.stats.totalItems, byStatus: data.stats.byStatus } : null), [data]);

  // The showcase (favorites, mix) always describes the WHOLE library, never the active filter.
  // Unfiltered, that is the data already loaded; with a filter on, the unfiltered copy is fetched (and cached).
  const filtered = Boolean(status || mediaType);
  const whole = useResource(R.profile(username), { enabled: filtered });
  const showcaseEntries = (filtered ? whole.data?.library : data?.library) ?? null;
  const featured = useMemo(() => (showcaseEntries ? pickFeatured(showcaseEntries) : null), [showcaseEntries]);
  const bannerPoster = featured?.items[0]?.media.posterUrl ?? null;
  const [editing, setEditing] = useState(false);

  if (loading && !data) return <ProfileSkeleton />;

  // Mode 1: private (or unknown) profile. The server answers 404 for both so nothing is revealed.
  if (error?.status === 404 || error?.code === 'USER_NOT_FOUND') {
    return (
      <Container className="max-w-2xl py-20">
        <Reveal>
          <PrivacyShield
            title="This profile is private"
            message="This profile isn't available. It is either private, or no one uses that username."
            action={
              <Button as={Link} to="/explore" variant="secondary">
                Explore titles
              </Button>
            }
          />
        </Reveal>
      </Container>
    );
  }
  if (error && !data) {
    return (
      <Container className="max-w-2xl py-20">
        <ProviderErrorState error={error} onRetry={reload} />
      </Container>
    );
  }
  if (!data) return null;

  const { profile, library, stats, library_is_private: libraryPrivate, isOwner } = data;
  const name = profile.display_name || `@${profile.username}`;
  const entries = library ?? [];
  const showLibrary = isOwner || !libraryPrivate;

  return (
    <div>
      {/* Header */}
      <div className="border-b border-white/[0.08]">
        <div className="relative h-36 w-full overflow-hidden bg-ink-surface sm:h-52" aria-hidden="true">
          {bannerPoster ? (
            <img src={bannerPoster} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl" />
          ) : (
            <>
              <div className="bg-dots mask-radial absolute inset-0 opacity-70" />
              <div className="bg-grid mask-radial absolute inset-0 opacity-70" />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-base via-ink-base/40 to-black/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.12),transparent_70%)]" />
          <GhostMark text="『記録』" position="right" className="!right-6" />
        </div>
        <Container>
          <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:gap-5">
              <Avatar
                src={profile.avatar_url}
                name={name}
                size="xl"
                className="relative z-10 -mt-14 !h-24 !w-24 border-4 border-ink-base sm:-mt-16 sm:!h-28 sm:!w-28"
              />
              <div className="min-w-0 flex-1 sm:pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-words text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{name}</h1>
                  {isOwner && (
                    <Badge tone="copper">
                      <Eye className="h-3 w-3" aria-hidden="true" /> Owner view
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-fg-muted">@{profile.username}</p>
                {profile.bio && <p className="mt-3 max-w-2xl whitespace-pre-line break-words text-sm leading-relaxed text-fg/90">{profile.bio}</p>}
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Joined {joined(profile.created_at)}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button variant="secondary" size="sm" leftIcon={Pencil} onClick={() => setEditing(true)} className="w-full shrink-0 sm:mt-3 sm:w-auto">
                Edit profile &amp; privacy
              </Button>
            )}
          </div>
        </Container>
      </div>
      {isOwner && <EditProfileModal open={editing} onClose={() => setEditing(false)} onSaved={reload} />}

      <Container className="py-10">
        {isOwner && libraryPrivate && (
          <p className="mb-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-fg-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Your library is private. Visitors see only your profile details. Private notes are never shown to anyone but you.
          </p>
        )}

        {/* Mode 2: public profile, private library */}
        {!showLibrary && (
          <Reveal>
            <PrivacyShield
              title="This user's library is private"
              message={`@${profile.username} has chosen not to share their saved titles, progress or statistics.`}
            />
          </Reveal>
        )}

        {/* Mode 3 and owner view: stats + library */}
        {showLibrary && stats && (
          <>
            <Stagger className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4" gap={0.06}>
              <StatCard label="Titles" value={stats.totalItems} icon={LibraryIcon} hint="in library" />
              <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} hint="finished titles" />
              <StatCard label="Episodes watched" value={stats.episodesWatched} icon={Tv} hint="across anime and TV" />
              <StatCard label="Average rating" value={stats.averageRating === null ? '—' : stats.averageRating}
                decimals={1} icon={Star} hint={stats.ratedCount > 0 ? `from ${stats.ratedCount} rated` : 'no ratings yet'} />
            </Stagger>

            {featured && featured.items.length > 0 && (
              <div className="mb-10">
                <FeaturedShelf featured={featured} />
              </div>
            )}

            {showcaseEntries && showcaseEntries.length > 0 && (
              <div className="mb-10 grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MilestoneBadges stats={stats} />
                </div>
                <ViewingMix entries={showcaseEntries} />
              </div>
            )}

            <h2 className="mb-3 text-lg font-bold text-fg">Library</h2>
            <LibraryFilters
              idPrefix="profile"
              status={status}
              mediaType={mediaType}
              sortKey={sortKey}
              counts={counts}
              onChange={(changes) => update(changes)}
            />

            <div className="mt-8">
              {entries.length === 0 ? (
                <EmptyState
                  icon={LibraryIcon}
                  title={status || mediaType ? 'No titles match' : 'Nothing here yet'}
                  message={status || mediaType ? 'Try another filter.' : `@${profile.username} hasn't added any titles yet.`}
                />
              ) : (
                <Stagger key={`${status}|${mediaType}|${sortKey}`} className={`${POSTER_GRID} transition-opacity ${loading ? 'opacity-50' : ''}`} gap={0.03}>
                  {entries.map((entry) => (
                    <StaggerItem key={entry.id}>
                      <PublicLibraryCard entry={entry} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>
          </>
        )}
      </Container>
    </div>
  );
}

