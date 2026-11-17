import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ImageOff } from 'lucide-react';
import { TYPE_LABELS, mediaPath } from './mediaUtils';

const TYPE_STYLES = {
  ANIME: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
  MOVIE: 'bg-red-950/80 text-red-300 border-red-800/60',
  TV: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
};

/** Poster card used by every grid (explore, trending). Links to the details page. */
export default function MediaCard({ media }) {
  return (
    <Link
      to={mediaPath(media)}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      aria-label={`${media.title} — ${TYPE_LABELS[media.mediaType]}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2A3245] bg-[#151922] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#3B455E] group-hover:shadow-xl group-hover:shadow-black/50">
        {media.posterUrl ? (
          <img
            src={media.posterUrl}
            alt={`${media.title} poster`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-[#9CA3AF]">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">No poster available</span>
          </div>
        )}

        <span
          className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur ${TYPE_STYLES[media.mediaType]}`}
        >
          {TYPE_LABELS[media.mediaType]}
        </span>

        {media.sourceRating != null && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-amber-400 backdrop-blur"
            title={`${media.sourceRatingName} rating`}
          >
            <Star className="h-3 w-3 fill-amber-400" />
            {media.sourceRating.toFixed(1)}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          {media.genres.length > 0 && (
            <p className="line-clamp-1 text-[11px] text-[#D1D5DB]">{media.genres.slice(0, 3).join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#F3F4F6] group-hover:text-white">
          {media.title}
        </h3>
        <p className="mt-0.5 text-xs text-[#9CA3AF]">{media.releaseYear ?? 'Release date unknown'}</p>
      </div>
    </Link>
  );
}
