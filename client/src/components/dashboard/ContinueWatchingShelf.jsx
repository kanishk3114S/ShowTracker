import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Play } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { CategoryBadge } from '../ui/Badge';
import ProgressBar, { progressPercent } from '../ui/ProgressBar';
import { Stagger, StaggerItem } from '../ui/motion';
import { mediaPath } from '../media/mediaUtils';
import { useMediaPrefetch } from '../../hooks/usePrefetch';
import { R } from '../../services/resources';
import { loadCached } from '../../lib/queryCache';
import { markEpisodeWatched, toApiError } from '../../services/api';

/**
 * Finds the first episode (in season/episode order, specials excluded) that the user has
 * not watched yet and marks it watched. Returns a short message for the card.
 */
async function watchNextEpisode(entry) {
  const seasonsRes = R.seasons(entry.mediaId);
  const seasons = (await loadCached(seasonsRes.key, () => seasonsRes.fetch(undefined), seasonsRes.staleMs)).seasons;
  const { watchedEpisodeIds } = await R.checkEntry(entry.mediaId).fetch(undefined); // always fresh: it decides what "next" is
  const watched = new Set(watchedEpisodeIds);
  const ordered = seasons
    .filter((s) => s.seasonNumber > 0)
    .flatMap((s) => s.episodes.map((e) => ({ ...e, seasonNumber: s.seasonNumber })));
  if (ordered.length === 0) return { done: false, message: 'No episode list yet' };
  const next = ordered.find((e) => !watched.has(e.id));
  if (!next) return { done: true, message: 'All caught up' };
  await markEpisodeWatched(entry.id, next.id);
  return { done: true, message: `Watched S${next.seasonNumber} · E${next.episodeNumber}` };
}

function ShelfCard({ entry, onChanged }) {
  const { media } = entry;
  const prefetchHandlers = useMediaPrefetch(media);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const total = entry.totalEpisodes ?? 0;
  const percent = progressPercent(entry.watchedEpisodesCount, total);
  const art = media.backdropUrl || media.posterUrl;
  const canOpen = media.provider && media.externalId;

  const markNext = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await watchNextEpisode(entry);
      setNote(result.message);
      if (result.done) onChanged?.();
    } catch (err) {
      setNote(toApiError(err)?.message ?? 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const image = (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:border-white/30">
      <PosterImage
        src={art}
        alt=""
        className="h-full w-full"
        imgClassName={`transition-transform duration-500 group-hover:scale-105 ${media.backdropUrl ? '' : 'object-top'}`}
        fallbackLabel={media.title}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
      <CategoryBadge type={media.mediaType} className="absolute left-2.5 top-2.5" />
      <span className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full scale-90 bg-accent text-ink-base opacity-0 shadow-lg transition duration-300 group-hover:scale-100 group-hover:opacity-100">
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-1 text-sm font-bold text-white">{media.title}</p>
      </div>
    </div>
  );

  return (
    <div className="group w-[17rem] shrink-0 snap-start sm:w-[19rem]" {...prefetchHandlers}>
      {canOpen ? (
        <Link to={mediaPath(media)} className="block rounded-2xl" aria-label={`Continue ${media.title}`}>
          {image}
        </Link>
      ) : (
        image
      )}
      <div className="mt-3 px-0.5">
        <ProgressBar value={entry.watchedEpisodesCount} max={total} label={`${media.title} progress`} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs tabular-nums text-fg-muted">
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">{total > 0 ? `${percent}%` : '—'}</span>
            {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps` : `${entry.watchedEpisodesCount} eps watched`}
          </p>
          <button
            type="button"
            onClick={markNext}
            disabled={busy}
            aria-label={`Mark the next episode of ${media.title} as watched`}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-semibold text-fg transition hover:bg-white/[0.12] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
            Next ep
          </button>
        </div>
        {note && (
          <p role="status" className="mt-1.5 text-[11px] text-fg-muted">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/** Horizontally scrolling shelf of titles with status WATCHING. */
export default function ContinueWatchingShelf({ items, onChanged }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" aria-label="Continue watching">
      {items.map((entry) => (
        <StaggerItem key={entry.id} className="shrink-0 snap-start">
          <ShelfCard entry={entry} onChanged={onChanged} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
