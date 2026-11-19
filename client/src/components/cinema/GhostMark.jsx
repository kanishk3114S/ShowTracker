import React from 'react';

/**
 * Editorial ghost typography: a huge, ~4-5% opacity word behind a heading, pure texture.
 * Kanji use an elegant Mincho serif (only the few glyphs used are downloaded, see index.html).
 * Decorative: aria-hidden, not selectable, never intercepts clicks. Place inside a `relative` parent.
 *
 *   text      『物語』 (stories) · 『記録』 (chronicles) · 『書庫』 (archive) · FEATURE FILM · SCENE 01 · 24FPS
 *   position  where it sits: 'right' (default) | 'left' | 'center'
 */
const POSITION = {
  right: 'right-0 top-1/2 -translate-y-1/2',
  left: 'left-0 top-1/2 -translate-y-1/2',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
};

export default function GhostMark({ text, position = 'right', className = '' }) {
  const isKanji = /[\u3000-\u9fff]/.test(text);
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute select-none whitespace-nowrap leading-none text-white/[0.045] ${POSITION[position]} ${
        isKanji ? 'font-mincho text-7xl font-semibold sm:text-8xl' : 'font-mono text-3xl font-bold uppercase tracking-[0.25em] sm:text-5xl'
      } ${className}`}
    >
      {text}
    </span>
  );
}
