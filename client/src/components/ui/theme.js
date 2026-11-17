/**
 * Visual identity.
 *
 * The interface is neutral near-black with ONE accent (gold). Color is reserved for
 * meaning: the accent marks the primary action, active state, ratings and progress;
 * a small colored dot marks a library status. Media types are told apart by their
 * label, not by a color.
 *
 * Every class string is written out in full: Tailwind only generates classes it can
 * see as complete strings in the source.
 */

const NEUTRAL_PILL = 'border-white/10 bg-white/[0.06] text-zinc-200';

export const TYPE_THEME = {
  ANIME: { label: 'Anime', pill: NEUTRAL_PILL, hover: 'group-hover:border-white/30', text: 'text-fg-muted', ring: 'ring-white/10' },
  MOVIE: { label: 'Movie', pill: NEUTRAL_PILL, hover: 'group-hover:border-white/30', text: 'text-fg-muted', ring: 'ring-white/10' },
  TV: { label: 'TV Show', pill: NEUTRAL_PILL, hover: 'group-hover:border-white/30', text: 'text-fg-muted', ring: 'ring-white/10' }
};

/** Status = neutral pill + one small colored dot. `live` statuses get a soft pulse. */
export const STATUS_THEME = {
  WATCHING: { label: 'Watching', pill: NEUTRAL_PILL, dot: 'bg-emerald-400', live: true },
  COMPLETED: { label: 'Completed', pill: NEUTRAL_PILL, dot: 'bg-sky-400', check: true },
  PLAN_TO_WATCH: { label: 'Plan to Watch', pill: NEUTRAL_PILL, dot: 'bg-zinc-400' },
  ON_HOLD: { label: 'On Hold', pill: NEUTRAL_PILL, dot: 'bg-amber-400' },
  DROPPED: { label: 'Dropped', pill: NEUTRAL_PILL, dot: 'bg-red-400' },
  REWATCHING: { label: 'Rewatching', pill: NEUTRAL_PILL, dot: 'bg-emerald-400', live: true }
};
