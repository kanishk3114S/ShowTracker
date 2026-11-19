/**
 * Genre personalities: every genre family gets its own colour, a faint gradient wash and a soft
 * glow on hover, so a row of genres reads at a glance. Class strings are spelled out in full
 * (Tailwind only generates classes it can see). Unknown genres fall back to frosted glass.
 *
 *   genreStyle(name) -> { base, active }
 *     base    resting look (gradient wash, tinted text and border, hover glow)
 *     active  stronger look for a selected filter chip
 */
const FRAME = 'bg-gradient-to-br backdrop-blur-md';

const FLAME = {
  base: `${FRAME} from-rose-500/20 to-orange-500/20 text-rose-300 border-rose-500/30 hover:border-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]`,
  active: `${FRAME} from-rose-500/45 to-orange-500/45 text-rose-50 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]`
};
const CYAN = {
  base: `${FRAME} from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]`,
  active: `${FRAME} from-cyan-500/45 to-blue-500/45 text-cyan-50 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]`
};
const AMETHYST = {
  base: `${FRAME} from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]`,
  active: `${FRAME} from-purple-500/45 to-indigo-500/45 text-purple-50 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]`
};
const SAKURA = {
  base: `${FRAME} from-pink-500/20 to-amber-500/20 text-pink-300 border-pink-500/30 hover:border-pink-400 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]`,
  active: `${FRAME} from-pink-500/45 to-amber-500/45 text-pink-50 border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]`
};
const OBSIDIAN = {
  base: `${FRAME} from-red-950/60 to-zinc-900 text-red-400 border-red-800/40 hover:border-red-600 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]`,
  active: `${FRAME} from-red-900/80 to-zinc-900 text-red-200 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]`
};
const GOLD = {
  base: `${FRAME} from-amber-500/20 to-emerald-500/20 text-amber-300 border-amber-500/30 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]`,
  active: `${FRAME} from-amber-500/45 to-emerald-500/45 text-amber-50 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]`
};
const FROSTED = {
  base: 'bg-white/[0.04] backdrop-blur-md text-fg-muted border-white/15 hover:border-white/30 hover:text-fg',
  active: 'bg-white/[0.14] backdrop-blur-md text-fg border-white/40'
};

// First match wins, so more specific families come first ("Sci-Fi & Fantasy" is sci-fi, not fantasy).
const RULES = [
  [/sci-?fi|science fiction|mecha|cyberpunk/, CYAN],
  [/action|shounen|shonen|war/, FLAME],
  [/horror|psychological|thriller|mystery|crime/, OBSIDIAN],
  [/fantasy|supernatural|magic|mahou/, AMETHYST],
  [/drama|romance|slice of life|music/, SAKURA],
  [/comedy|adventure|family|kids|sports|western/, GOLD]
];

export function genreStyle(name) {
  const key = String(name ?? '').trim().toLowerCase();
  for (const [pattern, style] of RULES) if (pattern.test(key)) return style;
  return FROSTED;
}
