import React from 'react';
import { Link } from 'react-router-dom';

/** Genre chips that link to Explore filtered by that genre. */
export default function GenreBadges({ genres, mediaType }) {
  if (!genres?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Genres">
      {genres.map((genre) => (
        <li key={genre}>
          <Link
            to={`/explore?type=${mediaType}&genre=${encodeURIComponent(genre)}`}
            className="block rounded-full border border-ink-edge bg-ink-surface px-3 py-1 text-xs font-medium text-fg-muted transition hover:border-copper/50 hover:text-fg"
          >
            {genre}
          </Link>
        </li>
      ))}
    </ul>
  );
}
