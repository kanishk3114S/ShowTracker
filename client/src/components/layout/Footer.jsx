import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import Container from './Container';

export const TMDB_NOTICE = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/**
 * TMDB asks for its approved logo next to the notice (client/public/tmdb-logo.svg).
 * If the file is missing the logo is simply omitted; the notice text always shows.
 */
export function TmdbLogo({ className = 'h-3.5' }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img src="/tmdb-logo.svg" alt="TMDB" className={className} onError={() => setMissing(true)} />;
}

export default function Footer() {
  return (
    <footer className="mb-20 border-t border-ink-line bg-ink-base md:mb-0 md:mt-10">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-fg-muted">
            One account. One library. Everything you watch.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg-muted">
            <li><Link className="transition hover:text-fg" to="/explore">Explore titles</Link></li>
            <li><Link className="transition hover:text-fg" to="/trending">Trending</Link></li>
            <li><Link className="transition hover:text-fg" to="/about">Credits &amp; data sources</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Data &amp; privacy</h2>
          <div className="mt-3 flex items-start gap-3 text-xs leading-relaxed text-fg-muted">
            <TmdbLogo className="mt-0.5 h-3.5 shrink-0" />
            <p>{TMDB_NOTICE} Anime data courtesy of AniList. Posters and descriptions belong to their owners.</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
            Your notes are always private. You choose whether your profile and library are public.
          </p>
        </div>
      </Container>
    </footer>
  );
}
