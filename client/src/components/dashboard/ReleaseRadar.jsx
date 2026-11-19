import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Compass } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import EmptyState from '../media/EmptyState';
import ProviderErrorState from '../media/ProviderErrorState';
import Button from '../ui/Button';
import PosterLink from '../ui/PosterLink';
import { Skeleton } from '../ui/Skeleton';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { useMediaPrefetch } from '../../hooks/usePrefetch';

const DAY = 86_400_000;
const WEEK_DAYS = 7;

const localIsoDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const startOfLocalDay = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Which section an item belongs to, from the viewer's own calendar:
 *   today  - airs on today's local date (or aired within the last few hours)
 *   week   - within the next 7 days
 *   soon   - later
 * AniList gives an exact instant; TMDB only a date, which is compared as a plain calendar date.
 */
export function sectionFor(item, nowMs) {
  const today = startOfLocalDay(nowMs);
  if (item.precision === 'day') {
    const [y, m, d] = item.airDate.split('-').map(Number);
    const days = Math.round((new Date(y, m - 1, d).getTime() - today) / DAY);
    if (days <= 0) return 'today';
    return days <= WEEK_DAYS ? 'week' : 'soon';
  }
  const at = Date.parse(item.airingAt);
  if (at < nowMs) return 'today'; // just aired
  const days = Math.floor((startOfLocalDay(at) - today) / DAY);
  if (days <= 0) return 'today';
  return days <= WEEK_DAYS ? 'week' : 'soon';
}

/** Groups already-sorted items into the three sections (empty ones are dropped). */
export function groupByAiringSection(items, nowMs) {
  const buckets = { today: [], week: [], soon: [] };
  for (const item of items) buckets[sectionFor(item, nowMs)].push(item);
  return [
    { key: 'today', title: 'Airing today', items: buckets.today },
    { key: 'week', title: 'This week', items: buckets.week },
    { key: 'soon', title: 'Coming soon', items: buckets.soon }
  ].filter((s) => s.items.length > 0);
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function whenLabel(item) {
  if (item.precision === 'day') {
    const [y, m, d] = item.airDate.split('-').map(Number);
    return dayFormat.format(new Date(y, m - 1, d));
  }
  const at = new Date(item.airingAt);
  return `${dayFormat.format(at)} · ${timeFormat.format(at)}`;
}

/** The ticking part: "2d 14h 22m 10s". Exact times tick every second; date-only (TMDB) shows days. */
function Countdown({ item, offsetMs }) {
  const now = useNow() + offsetMs;
  if (item.precision === 'day') {
    const [y, m, d] = item.airDate.split('-').map(Number);
    const days = Math.round((new Date(y, m - 1, d).getTime() - startOfLocalDay(now)) / DAY);
    const text = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
    return <span className="font-mono text-sm font-semibold tabular-nums text-fg">{text}</span>;
  }
  const seconds = (Date.parse(item.airingAt) - now) / 1000;
  const aired = seconds <= 0;
  const minutes = Math.max(0, Math.floor(seconds / 60));
  return (
    <>
      <span aria-hidden="true" className={`font-mono text-sm font-semibold tabular-nums ${aired ? 'text-emerald-300' : 'text-fg'}`}>
        {aired ? 'Just aired' : formatCountdown(seconds)}
      </span>
      <span className="sr-only">{aired ? 'Just aired' : `Airs in about ${minutes} minutes`}</span>
    </>
  );
}

function RadarItem({ item, offsetMs, today }) {
  const prefetch = useMediaPrefetch(item);
  const episode = item.nextEpisode
    ? `${item.seasonNumber ? `S${item.seasonNumber} ` : ''}Episode ${item.nextEpisode}`
    : 'New episode';
  return (
    <li>
      <PosterLink
        to={mediaPath(item)}
        {...prefetch}
        aria-label={`${item.title}, ${episode}, ${whenLabel(item)}`}
        className="glass-lite flex items-center gap-3 !rounded-2xl p-2.5 pr-4 transition-colors hover:border-accent/40"
      >
        <PosterImage src={item.posterUrl} alt="" className="h-[4.5rem] w-12 shrink-0 rounded-lg border border-white/10" fallbackLabel="" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{item.title}</span>
          <span className="mt-0.5 block truncate text-xs text-fg-muted">
            {episode} <span className="text-fg-subtle">· {TYPE_LABELS[item.mediaType]}</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-fg-subtle">{whenLabel(item)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-right">
          {today && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-4 tracking-wider text-emerald-300">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              REC ● TODAY
            </span>
          )}
          <Countdown item={item} offsetMs={offsetMs} />
        </span>
      </PosterLink>
    </li>
  );
}

function RadarSkeleton() {
  return (
    <div role="status" aria-label="Loading release radar" className="space-y-2">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[5.25rem] rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Release Radar: live countdowns to the next episode of the anime and TV shows in your library
 * (Watching and Plan to Watch). `compact` is the dashboard card: the next few releases + a link.
 */
export default function ReleaseRadar({ compact = false, limit = 4 }) {
  const { data, error, loading, reload } = useResource(R.upcoming());
  // Use the server's clock, so a wrong device clock cannot show a wrong countdown.
  const offsetMs = useMemo(() => (data?.serverTime ? Date.parse(data.serverTime) - Date.now() : 0), [data]);
  const now = useNow() + offsetMs;

  const items = data?.items ?? [];
  const shown = compact ? items.slice(0, limit) : items;
  const sections = useMemo(() => groupByAiringSection(shown, now), [shown, now]);

  // The dashboard card stays out of the way: nothing to show (or still loading) means no card at all.
  if (compact && ((loading && !data) || (error && !data) || items.length === 0)) return null;

  if (loading && !data) return <RadarSkeleton />;
  if (error && !data) return <ProviderErrorState error={error} onRetry={reload} compact />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        watermark="SCENE 01 · 24FPS"
        title="Nothing airing soon"
        message="Add anime or TV shows that are still airing to Watching or Plan to Watch, and their next episodes will count down here."
        action={
          <Button as={Link} to="/trending" variant="primary" leftIcon={Compass}>
            Browse trending
          </Button>
        }
      />
    );
  }

  return (
    <div className="relative space-y-6">
      {compact && (
        <div className="flex items-end justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
            <span className="h-5 w-1 rounded-full bg-accent" aria-hidden="true" />
            Release radar
          </h2>
          <Link to="/library?view=radar" className="text-sm font-semibold text-accent transition hover:text-accent-hover">
            Full radar
          </Link>
        </div>
      )}
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            {section.key === 'today' && (
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            )}
            {section.title}
            <span className="font-mono text-fg-subtle/70">{section.items.length}</span>
          </h3>
          <ul className={compact ? 'space-y-2' : 'grid gap-2.5 md:grid-cols-2'}>
            {section.items.map((item) => (
              <RadarItem key={item.entryId} item={item} offsetMs={offsetMs} today={section.key === 'today'} />
            ))}
          </ul>
        </section>
      ))}
      {compact && items.length > shown.length && (
        <Link to="/library?view=radar" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          {items.length - shown.length} more on the radar <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
