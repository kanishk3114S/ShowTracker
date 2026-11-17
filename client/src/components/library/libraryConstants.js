export const STATUS_ORDER = ['WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'REWATCHING'];

export const STATUS_META = {
  WATCHING: { label: 'Watching', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' },
  PLAN_TO_WATCH: { label: 'Plan to Watch', badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60' },
  COMPLETED: { label: 'Completed', badge: 'bg-sky-950/80 text-sky-300 border-sky-800/60' },
  ON_HOLD: { label: 'On Hold', badge: 'bg-amber-950/80 text-amber-300 border-amber-800/60' },
  DROPPED: { label: 'Dropped', badge: 'bg-red-950/80 text-red-300 border-red-800/60' },
  REWATCHING: { label: 'Rewatching', badge: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-800/60' }
};

/** 10, 9.5, ... 0.5 (the API accepts 0-10 with one decimal). */
export const RATING_OPTIONS = Array.from({ length: 20 }, (_, i) => 10 - i * 0.5);

export const NOTES_MAX = 2000;
