/**
 * Colour tokens a custom group can use. The tokens are the same strings the API accepts
 * (server/src/modules/library/groups.validation.js). Every class is spelled out in full so
 * Tailwind can see it.
 */
export const GROUP_COLORS = ['amber', 'rose', 'cyan', 'purple', 'pink', 'emerald', 'sky', 'zinc'];

const STYLES = {
  amber: { dot: 'bg-amber-400', active: 'border-amber-400/60 bg-amber-400/15 text-amber-100', ring: 'ring-amber-400' },
  rose: { dot: 'bg-rose-400', active: 'border-rose-400/60 bg-rose-400/15 text-rose-100', ring: 'ring-rose-400' },
  cyan: { dot: 'bg-cyan-400', active: 'border-cyan-400/60 bg-cyan-400/15 text-cyan-100', ring: 'ring-cyan-400' },
  purple: { dot: 'bg-purple-400', active: 'border-purple-400/60 bg-purple-400/15 text-purple-100', ring: 'ring-purple-400' },
  pink: { dot: 'bg-pink-400', active: 'border-pink-400/60 bg-pink-400/15 text-pink-100', ring: 'ring-pink-400' },
  emerald: { dot: 'bg-emerald-400', active: 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100', ring: 'ring-emerald-400' },
  sky: { dot: 'bg-sky-400', active: 'border-sky-400/60 bg-sky-400/15 text-sky-100', ring: 'ring-sky-400' },
  zinc: { dot: 'bg-zinc-300', active: 'border-zinc-300/60 bg-zinc-300/15 text-zinc-100', ring: 'ring-zinc-300' }
};

export const groupStyle = (color) => STYLES[color] ?? STYLES.amber;
