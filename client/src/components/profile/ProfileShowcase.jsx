import React, { useMemo } from 'react';
import { Award, CheckCircle2, Heart, Library as LibraryIcon, Lock, Star, Tv } from 'lucide-react';
import Card from '../ui/Card';
import PublicLibraryCard from '../library/PublicLibraryCard';
import { TYPE_LABELS } from '../media/mediaUtils';

/* ---------------------------------------------------------------- milestones */

/** Each track has ascending tiers. A profile shows its highest earned tier and the next goal. */
const TRACKS = [
  {
    key: 'titles',
    icon: LibraryIcon,
    read: (s) => s.totalItems ?? 0,
    unit: 'titles saved',
    tiers: [
      [1, 'First Pick'],
      [10, 'Collector'],
      [25, 'Curator'],
      [50, 'Archivist'],
      [100, 'Grand Library']
    ]
  },
  {
    key: 'completed',
    icon: CheckCircle2,
    read: (s) => s.completed ?? 0,
    unit: 'titles finished',
    tiers: [
      [1, 'Finisher'],
      [10, 'Closer'],
      [25, 'Completionist'],
      [50, 'Credits Roller']
    ]
  },
  {
    key: 'episodes',
    icon: Tv,
    read: (s) => s.episodesWatched ?? 0,
    unit: 'episodes watched',
    tiers: [
      [10, 'Getting Hooked'],
      [100, 'Binge Watcher'],
      [500, 'Marathoner'],
      [1000, 'Couch Legend']
    ]
  },
  {
    key: 'rated',
    icon: Star,
    read: (s) => s.ratedCount ?? 0,
    unit: 'titles rated',
    tiers: [
      [1, 'First Verdict'],
      [10, 'Critic'],
      [25, 'Tastemaker']
    ]
  }
];

/** Pure: turns library stats into the badges to display (earned tier + next locked tier per track). */
export function computeMilestones(stats) {
  if (!stats) return [];
  const badges = [];
  for (const track of TRACKS) {
    const value = track.read(stats);
    const earned = track.tiers.filter(([goal]) => value >= goal);
    const next = track.tiers.find(([goal]) => value < goal);
    if (earned.length) {
      const [goal, label] = earned[earned.length - 1];
      badges.push({ id: `${track.key}-${goal}`, icon: track.icon, label, detail: `${goal}+ ${track.unit}`, earned: true });
    }
    if (next) {
      badges.push({ id: `${track.key}-${next[0]}`, icon: track.icon, label: next[1], detail: `${value} / ${next[0]} ${track.unit}`, earned: false });
    }
  }
  return badges;
}

export function MilestoneBadges({ stats }) {
  const badges = useMemo(() => computeMilestones(stats), [stats]);
  if (badges.length === 0) return null;
  const earnedCount = badges.filter((b) => b.earned).length;
  return (
    <section aria-labelledby="milestones-heading">
      <h2 id="milestones-heading" className="mb-3 flex items-center gap-2 text-lg font-bold text-fg">
        <Award className="h-5 w-5 text-accent" aria-hidden="true" /> Milestones
        <span className="text-sm font-medium text-fg-subtle">{earnedCount} earned</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {badges.map(({ id, icon: Icon, label, detail, earned }) => (
          <li
            key={id}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              earned ? 'border-accent/30 bg-accent/[0.07]' : 'border-white/[0.07] bg-white/[0.02] opacity-70'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                earned ? 'border-accent/30 bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.04] text-fg-subtle'
              }`}
            >
              {earned ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-fg">{label}</span>
              <span className="block truncate text-xs text-fg-muted">
                {detail}
                <span className="sr-only">{earned ? ' (earned)' : ' (locked)'}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ favorites */

/** Favorites first (best rated on top). With no favorites, the user's top rated titles stand in. */
export function pickFeatured(entries, limit = 6) {
  const byRating = (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  const favorites = entries.filter((e) => e.isFavorite).sort(byRating);
  if (favorites.length) return { items: favorites.slice(0, limit), kind: 'favorites' };
  const rated = entries.filter((e) => e.rating !== null).sort(byRating);
  return { items: rated.slice(0, limit), kind: 'top-rated' };
}

export function FeaturedShelf({ featured }) {
  if (!featured.items.length) return null;
  const isFav = featured.kind === 'favorites';
  const Icon = isFav ? Heart : Star;
  return (
    <section aria-labelledby="featured-heading">
      <h2 id="featured-heading" className="mb-3 flex items-center gap-2 text-lg font-bold text-fg">
        <Icon className="h-5 w-5 text-accent" aria-hidden="true" /> {isFav ? 'Featured favorites' : 'Top rated'}
      </h2>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {featured.items.map((entry) => (
          <li key={entry.id} className="min-w-0">
            <PublicLibraryCard entry={entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- viewing mix */

/**
 * What the library is made of. Built from the fields the public library actually
 * exposes (media type and rating); per-title genres are not part of that payload.
 */
export function ViewingMix({ entries }) {
  const { types, rated, average } = useMemo(() => {
    const counts = {};
    let ratingSum = 0;
    let ratedCount = 0;
    for (const e of entries) {
      counts[e.media.mediaType] = (counts[e.media.mediaType] ?? 0) + 1;
      if (e.rating !== null) {
        ratingSum += e.rating;
        ratedCount += 1;
      }
    }
    const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { types: list, rated: ratedCount, average: ratedCount ? ratingSum / ratedCount : null };
  }, [entries]);

  if (entries.length === 0) return null;
  const top = types[0];
  return (
    <Card>
      <h2 className="text-lg font-bold text-fg">Viewing mix</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Mostly <span className="font-semibold text-fg">{TYPE_LABELS[top[0]] ?? top[0]}</span>
        {average !== null && (
          <>
            {' '}
            · rates <span className="font-semibold text-fg">{average.toFixed(1)}</span> on average across {rated} titles
          </>
        )}
      </p>
      <ul className="mt-4 space-y-3">
        {types.map(([type, count]) => {
          const pct = Math.round((count / entries.length) * 100);
          return (
            <li key={type}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold text-fg">{TYPE_LABELS[type] ?? type}</span>
                <span className="tabular-nums text-fg-muted">
                  {count} · {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={`${TYPE_LABELS[type] ?? type}: ${pct}% of titles`}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
