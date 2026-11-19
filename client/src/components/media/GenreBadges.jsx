import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { genreStyle } from './genreStyles';
import { usePrefetchHandlers } from '../../hooks/usePrefetch';
import { prefetchRoute } from '../../routes/pages';
import { prefetchResource, R } from '../../services/resources';

const MotionLink = motion.create(Link);
const HOVER = { y: -2, scale: 1.04 };
const TAP = { scale: 0.95 };
const SPRING = { type: 'spring', stiffness: 500, damping: 28 };

function GenreChip({ genre, mediaType }) {
  const style = genreStyle(genre);
  // Hovering (or focusing/touching) warms Explore's data for this genre, so the click opens instantly.
  const prefetch = usePrefetchHandlers(() => {
    prefetchRoute('/explore');
    prefetchResource(R.search({ type: mediaType, genre: [genre] }));
  });
  return (
    <MotionLink
      to={`/explore?type=${mediaType}&genre=${encodeURIComponent(genre)}`}
      whileHover={HOVER}
      whileTap={TAP}
      transition={SPRING}
      {...prefetch}
      className={`block rounded-full border px-3 py-1 text-xs font-semibold transition-[border-color,box-shadow,color] duration-200 ${style.base}`}
    >
      {genre}
    </MotionLink>
  );
}

/** Genre chips with their own colour personality; each links to Explore filtered by that genre. */
export default function GenreBadges({ genres, mediaType }) {
  if (!genres?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Genres">
      {genres.map((genre) => (
        <li key={genre}>
          <GenreChip genre={genre} mediaType={mediaType} />
        </li>
      ))}
    </ul>
  );
}
