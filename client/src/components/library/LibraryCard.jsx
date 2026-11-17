import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ImageOff, Star } from 'lucide-react';
import { STATUS_META, STATUS_ORDER, RATING_OPTIONS } from './libraryConstants';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { updateLibraryEntry, toApiError } from '../../services/api';

const selectClass =
  'w-full rounded-md border border-[#2A3245] bg-[#0B0E14] px-2 py-1 text-xs text-white outline-none focus:border-red-500 disabled:opacity-50';

/** One tracked title in the library grid, with quick status / rating changes. */
export default function LibraryCard({ entry, onChanged }) {
  const { media } = entry;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const meta = STATUS_META[entry.status];
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const total = entry.totalEpisodes ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((entry.watchedEpisodesCount / total) * 100)) : 0;
  const detailsPath = media.provider && media.externalId ? mediaPath(media) : null;

  const change = async (changes) => {
    setBusy(true);
    setError(null);
    try {
      await updateLibraryEntry(entry.id, changes);
      onChanged();
    } catch (err) {
      setError(toApiError(err)?.message ?? 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const poster = (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-[#2A3245] bg-[#151922] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#3B455E] group-hover:shadow-xl group-hover:shadow-black/50">
      {media.posterUrl ? (
        <img src={media.posterUrl} alt={`${media.title} poster`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-[#9CA3AF]">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs">No poster</span>
        </div>
      )}
      <span className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur ${meta.badge}`}>
        {meta.label}
      </span>
      {entry.isFavorite && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 p-1.5" title="Favorite">
          <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" />
        </span>
      )}
      {entry.rating !== null && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
          <Star className="h-3 w-3 fill-amber-400" />
          {entry.rating.toFixed(1)}
        </span>
      )}
    </div>
  );

  return (
    <article className="group" aria-label={media.title}>
      {detailsPath ? (
        <Link to={detailsPath} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          {poster}
        </Link>
      ) : (
        poster
      )}

      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#F3F4F6]">{media.title}</h3>
        <p className="mt-0.5 text-xs text-[#9CA3AF]">
          {TYPE_LABELS[media.mediaType]}
          {media.releaseYear ? ` · ${media.releaseYear}` : ''}
        </p>

        {hasEpisodes && (
          <div className="mt-2">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[#1C2230]"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${media.title} progress`}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-500" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">
              {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps` : `${entry.watchedEpisodesCount} eps watched`}
            </p>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <select
            aria-label={`Status for ${media.title}`}
            value={entry.status}
            disabled={busy}
            onChange={(e) => change({ status: e.target.value })}
            className={selectClass}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select
            aria-label={`Rating for ${media.title}`}
            value={entry.rating ?? ''}
            disabled={busy}
            onChange={(e) => change({ rating: e.target.value === '' ? null : Number(e.target.value) })}
            className={selectClass}
          >
            <option value="">Not rated</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.toFixed(1)}
              </option>
            ))}
          </select>
        </div>
        {error && <p role="alert" className="mt-1 text-[11px] text-red-300">{error}</p>}
      </div>
    </article>
  );
}
