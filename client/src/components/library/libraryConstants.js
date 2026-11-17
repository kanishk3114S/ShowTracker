import { STATUS_BADGES } from '../ui/Badge';

export const STATUS_ORDER = ['WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'REWATCHING'];

/** Status -> { label, tone }. Colors live in ui/Badge so there is one source of truth. */
export const STATUS_META = STATUS_BADGES;

/** 10, 9.5, ... 0.5 (the API accepts 0-10 with one decimal). */
export const RATING_OPTIONS = Array.from({ length: 20 }, (_, i) => 10 - i * 0.5);

export const NOTES_MAX = 2000;

export const fieldClass =
  'h-10 w-full rounded-lg border border-ink-edge bg-ink-raised px-3 text-sm text-fg outline-none transition focus:border-copper/70 focus:ring-2 focus:ring-copper/20 disabled:opacity-50';
