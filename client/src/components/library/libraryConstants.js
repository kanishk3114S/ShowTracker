import { STATUS_BADGES } from '../ui/Badge';

export const STATUS_ORDER = ['WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'REWATCHING'];

/** Status -> { label, tone }. Colors live in ui/Badge so there is one source of truth. */
export const STATUS_META = STATUS_BADGES;

/** 10, 9.5, ... 0.5 (the API accepts 0-10 with one decimal). */
export const RATING_OPTIONS = Array.from({ length: 20 }, (_, i) => 10 - i * 0.5);

export const NOTES_MAX = 2000;

export const fieldClass =
  'h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-fg outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20 disabled:opacity-50';
