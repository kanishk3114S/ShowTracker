import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const TMDB_NOTICE = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/**
 * TMDB asks for its approved logo next to the notice. The logo file is not
 * bundled: download it from https://www.themoviedb.org/about/logos-attribution
 * and save it as client/public/tmdb-logo.svg; it then appears automatically.
 */
export function TmdbLogo({ className = 'h-3.5' }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img src="/tmdb-logo.svg" alt="TMDB" className={className} onError={() => setMissing(true)} />;
}

export default function AppFooter() {
  return (
    <footer className="mt-16 border-t border-[#2A3245] bg-[#0B0E14]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-[#9CA3AF] sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <TmdbLogo />
          <p className="max-w-xl">
            {TMDB_NOTICE} Anime data courtesy of AniList. Images and descriptions belong to their respective owners.
          </p>
        </div>
        <Link to="/about" className="shrink-0 font-medium text-[#D1D5DB] hover:text-white">
          Credits &amp; data sources
        </Link>
      </div>
    </footer>
  );
}
