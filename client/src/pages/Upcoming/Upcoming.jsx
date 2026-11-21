import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Compass, Film, Tv, Clock } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import PosterImage from '../../components/media/PosterImage';
import EmptyState from '../../components/media/EmptyState';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import Button from '../../components/ui/Button';
import PosterLink from '../../components/ui/PosterLink';
import { Skeleton } from '../../components/ui/Skeleton';
import { TYPE_LABELS, mediaPath } from '../../components/media/mediaUtils';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { useMediaPrefetch } from '../../hooks/usePrefetch';
import { useDocumentHead } from '../../hooks/useDocumentHead';

const DAY_MS = 86_400_000;

const startOfLocalDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Determines which chronological section an episode falls into:
 *   today      - Airs today in local viewer's calendar (or recently aired)
 *   tomorrow   - Airs tomorrow in local calendar
 *   this_week  - Airs in 2 to 7 days
 *   next_week  - Airs in 8 to 14 days
 *   later      - Airs in 15 to 28 days
 */
export function getUpcomingSection(item, nowMs) {
  const today = startOfLocalDay(nowMs);
  let targetDayMs;
  if (item.precision === 'day' && item.airDate) {
    const [y, m, d] = item.airDate.split('-').map(Number);
    targetDayMs = new Date(y, m - 1, d).getTime();
  } else {
    const at = Date.parse(item.airingAt || item.releaseDate);
    targetDayMs = isNaN(at) ? today : startOfLocalDay(at);
  }

  const diffDays = Math.round((targetDayMs - today) / DAY_MS);

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'this_week';
  if (diffDays <= 14) return 'next_week';
  return 'later';
}

/**
 * Groups items into chronological buckets and drops empty sections.
 */
export function groupUpcomingItems(items, nowMs) {
  const buckets = {
    today: [],
    tomorrow: [],
    this_week: [],
    next_week: [],
    later: []
  };

  for (const item of items) {
    const bucket = getUpcomingSection(item, nowMs);
    if (buckets[bucket]) {
      buckets[bucket].push(item);
    } else {
      buckets.later.push(item);
    }
  }

  return [
    { key: 'today', title: 'Today', subtitle: 'Airing today', items: buckets.today },
    { key: 'tomorrow', title: 'Tomorrow', subtitle: 'Airing tomorrow', items: buckets.tomorrow },
    { key: 'this_week', title: 'This week', subtitle: 'Releasing in the next 7 days', items: buckets.this_week },
    { key: 'next_week', title: 'Next week', subtitle: 'Releasing in 8 to 14 days', items: buckets.next_week },
    { key: 'later', title: 'Later in the next 28 days', subtitle: 'Releasing in 15 to 28 days', items: buckets.later }
  ].filter((s) => s.items.length > 0);
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function whenLabel(item) {
  if (item.precision === 'day' && item.airDate) {
    const [y, m, d] = item.airDate.split('-').map(Number);
    return dayFormat.format(new Date(y, m - 1, d));
  }
  const at = new Date(item.airingAt || item.releaseDate);
  if (isNaN(at.getTime())) return item.releaseDate || item.airDate || 'TBD';
  return `${dayFormat.format(at)} · ${timeFormat.format(at)}`;
}

function StatusBadge({ status, upcomingStatus }) {
  if (upcomingStatus === 'UPCOMING_SEASON') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-300">
        New Season
      </span>
    );
  }
  if (upcomingStatus === 'ON_HIATUS') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
        Hiatus Return
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
      Airing
    </span>
  );
}

function CountdownBadge({ item, offsetMs }) {
  const now = useNow() + offsetMs;
  if (item.precision === 'day' && item.airDate) {
    const [y, m, d] = item.airDate.split('-').map(Number);
    const days = Math.round((new Date(y, m - 1, d).getTime() - startOfLocalDay(now)) / DAY_MS);
    const text = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
    return <span className="font-mono text-xs font-semibold tabular-nums text-fg">{text}</span>;
  }
  const seconds = (Date.parse(item.airingAt || item.releaseDate) - now) / 1000;
  const aired = seconds <= 0;
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return (
    <>
      <span
        aria-hidden="true"
        className={`font-mono text-xs font-semibold tabular-nums ${aired ? 'text-emerald-300' : 'text-fg'}`}
      >
        {aired ? 'Just aired' : formatCountdown(seconds)}
      </span>
      <span className="sr-only">{aired ? 'Just aired' : `Airs in about ${minutes} minutes`}</span>
    </>
  );
}

function UpcomingCard({ item, offsetMs, isToday }) {
  const prefetch = useMediaPrefetch(item);
  const epNumber = item.episodeNumber || item.nextEpisode;
  const epCode = item.seasonNumber ? `S${String(item.seasonNumber).padStart(2, '0')} E${String(epNumber).padStart(2, '0')}` : `Episode ${epNumber}`;

  return (
    <li className="relative group">
      <PosterLink
        to={mediaPath(item)}
        {...prefetch}
        aria-label={`${item.title}, ${epCode}, ${item.episodeTitle ? `${item.episodeTitle}, ` : ''}${whenLabel(item)}`}
        className="glass-lite flex flex-col sm:flex-row items-start sm:items-center gap-4 !rounded-2xl p-4 transition-all duration-200 hover:border-accent/40 hover:bg-white/[0.04]"
      >
        <div className="relative shrink-0">
          <PosterImage
            src={item.posterUrl}
            alt=""
            className="h-24 w-16 sm:h-28 sm:w-20 rounded-xl border border-white/10 object-cover shadow-md"
            fallbackLabel=""
          />
          {isToday && (
            <span className="absolute -top-1.5 -left-1.5 inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-950/90 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300 shadow">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              TODAY
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-accent">{epCode}</span>
            <span className="text-fg-subtle">·</span>
            <span className="text-xs text-fg-muted">{TYPE_LABELS[item.mediaType] || item.mediaType}</span>
            <StatusBadge status={item.status} upcomingStatus={item.upcomingStatus} />
          </div>

          <h3 className="truncate text-base font-bold text-white group-hover:text-accent transition-colors">
            {item.title}
          </h3>

          {item.episodeTitle && (
            <p className="mt-0.5 truncate text-xs font-medium text-fg-muted">
              "{item.episodeTitle}"
            </p>
          )}

          {item.overview && (
            <p className="mt-1 line-clamp-1 text-xs text-fg-subtle">
              {item.overview}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
            <Clock className="h-3.5 w-3.5 text-fg-subtle/80" aria-hidden="true" />
            <span>{whenLabel(item)}</span>
          </div>
        </div>

        <div className="mt-2 sm:mt-0 flex w-full sm:w-auto shrink-0 flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 border-t sm:border-t-0 border-white/[0.06] pt-2 sm:pt-0">
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Countdown</span>
          <CountdownBadge item={item} offsetMs={offsetMs} />
        </div>
      </PosterLink>
    </li>
  );
}

function UpcomingSkeleton() {
  return (
    <div role="status" aria-label="Loading upcoming episodes" className="space-y-6">
      {Array.from({ length: 2 }, (_, sIdx) => (
        <div key={sIdx} className="space-y-3">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Upcoming() {
  useDocumentHead({
    title: 'Upcoming Episodes — ShowTracker',
    description: 'Keep track of the next episodes from your library with confirmed air dates.',
    noindex: true
  });

  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'ANIME' | 'TV'
  const { data, error, loading, reload } = useResource(R.upcoming());

  const offsetMs = useMemo(() => (data?.serverTime ? Date.parse(data.serverTime) - Date.now() : 0), [data]);
  const referenceMs = useMemo(() => Date.now() + offsetMs, [offsetMs]);

  const allItems = data?.items ?? [];

  const filteredItems = useMemo(() => {
    if (typeFilter === 'ALL') return allItems;
    return allItems.filter((it) => it.mediaType === typeFilter);
  }, [allItems, typeFilter]);

  const sections = useMemo(() => groupUpcomingItems(filteredItems, referenceMs), [filteredItems, referenceMs]);

  return (
    <Container className="py-8 space-y-8">
      <PageHeader
        title="Upcoming Episodes"
        description="Keep track of the next episodes from your library."
        icon={CalendarClock}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Upcoming Episodes' }
        ]}
        actions={
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === 'ALL'
                  ? 'bg-accent text-ink-base shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              All ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('ANIME')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === 'ANIME'
                  ? 'bg-accent text-ink-base shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              Anime ({allItems.filter((it) => it.mediaType === 'ANIME').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('TV')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                typeFilter === 'TV'
                  ? 'bg-accent text-ink-base shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Tv className="h-3.5 w-3.5" aria-hidden="true" />
              TV Shows ({allItems.filter((it) => it.mediaType === 'TV').length})
            </button>
          </div>
        }
      />

      {loading && !data && <UpcomingSkeleton />}
      {error && !data && <ProviderErrorState error={error} onRetry={reload} />}

      {!loading && !error && allItems.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          watermark="SCHEDULE · 28-DAY WINDOW"
          title="Nothing upcoming just yet."
          message="We'll show new episodes here when your saved shows have confirmed release dates."
          action={
            <Button as={Link} to="/explore" variant="primary" leftIcon={Compass}>
              Explore shows
            </Button>
          }
        />
      )}

      {!loading && !error && allItems.length > 0 && filteredItems.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-fg-muted">No upcoming releases match the selected filter.</p>
          <Button variant="ghost" className="mt-3 text-accent" onClick={() => setTypeFilter('ALL')}>
            Show all releases
          </Button>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.title} className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {section.key === 'today' && (
                      <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                    )}
                    {section.title}
                  </h2>
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-xs text-fg-muted">
                    {section.items.length}
                  </span>
                </div>
                <span className="text-xs text-fg-subtle">{section.subtitle}</span>
              </div>

              <ul className="grid gap-3">
                {section.items.map((item) => (
                  <UpcomingCard
                    key={item.id || `${item.entryId}-${item.episodeNumber || item.nextEpisode}`}
                    item={item}
                    offsetMs={offsetMs}
                    isToday={section.key === 'today'}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
