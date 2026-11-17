import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import ProviderErrorState from '../media/ProviderErrorState';
import Button from '../ui/Button';
import Tabs from '../ui/Tabs';
import ProgressBar, { progressPercent } from '../ui/ProgressBar';
import { Skeleton } from '../ui/Skeleton';
import {
  getMediaSeasons,
  markEpisodeWatched,
  markEpisodeUnwatched,
  markSeasonWatched,
  toApiError
} from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { formatDate } from '../media/mediaUtils';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Season/episode list with watch toggles.
 *  - Checking an episode updates the screen immediately (optimistic) and is
 *    rolled back with a message if the server rejects it.
 *  - Requests are sent one after another, so rapid clicks can never be
 *    applied out of order.
 *  - The progress numbers shown are the server's (derived with COUNT(*)).
 *
 * Props: entry, mediaId, watchedIds (Set), onLocalChange(ids, watched, delta), onProgress(summary, ids, watched)
 */
export default function EpisodeTracker({ entry, mediaId, watchedIds, onLocalChange, onProgress }) {
  const { data, error, loading, reload } = useApiResource((signal) => getMediaSeasons(mediaId, signal), [mediaId]);
  const [chosenSeason, setChosenSeason] = useState(null);
  const [pending, setPending] = useState(() => new Set());
  const [actionError, setActionError] = useState(null);
  const queue = useRef(Promise.resolve());

  const seasons = data?.seasons ?? [];
  const activeId =
    seasons.find((s) => s.id === chosenSeason)?.id ?? (seasons.find((s) => s.seasonNumber > 0) ?? seasons[0])?.id;
  const season = seasons.find((s) => s.id === activeId);

  const total = entry.totalEpisodes ?? 0;
  const watched = entry.watchedEpisodesCount ?? 0;
  const percent = progressPercent(watched, total);

  const mark = (key, ids, nextWatched, delta, request) => {
    onLocalChange(ids, nextWatched, delta); // optimistic
    setPending((prev) => new Set(prev).add(key));
    setActionError(null);
    queue.current = queue.current.then(async () => {
      try {
        const summary = await request();
        onProgress(summary, ids, nextWatched);
      } catch (err) {
        onLocalChange(ids, !nextWatched, -delta); // roll back
        setActionError(toApiError(err)?.message ?? 'Could not save that change.');
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    });
  };

  const toggleEpisode = (episode) => {
    const isWatched = watchedIds.has(episode.id);
    const counts = season.seasonNumber > 0;
    mark(
      episode.id,
      [episode.id],
      !isWatched,
      counts ? (isWatched ? -1 : 1) : 0,
      () => (isWatched ? markEpisodeUnwatched(entry.id, episode.id) : markEpisodeWatched(entry.id, episode.id))
    );
  };

  const markWholeSeason = () => {
    const toMark = season.episodes.filter((e) => !watchedIds.has(e.id)).map((e) => e.id);
    if (toMark.length === 0) return;
    mark(`season:${season.id}`, toMark, true, season.seasonNumber > 0 ? toMark.length : 0, () => markSeasonWatched(entry.id, season.id));
  };

  if (loading && !data) {
    return (
      <div role="status" aria-label="Loading episodes" className="mt-6 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-6">
        <ProviderErrorState error={error} onRetry={reload} compact />
      </div>
    );
  }
  if (seasons.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-ink-edge px-4 py-5 text-sm text-fg-muted">
        The provider has no episode list for this title yet, so episodes cannot be tracked. Check back later.
      </p>
    );
  }

  const seasonAllWatched = season.episodes.length > 0 && season.episodes.every((e) => watchedIds.has(e.id));
  const seasonTabs = seasons.map((s) => ({ value: s.id, label: s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}` }));

  return (
    <section className="mt-6" aria-label="Episode tracker">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Episodes</h3>
        <p className="text-sm tabular-nums text-fg" aria-live="polite">
          {total > 0 ? `${watched} / ${total} episodes watched (${percent}%)` : `${watched} watched`}
        </p>
      </div>
      <ProgressBar value={watched} max={total} label="Episodes watched" className="mb-5" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs name="episode-seasons" ariaLabel="Seasons" tabs={seasonTabs} value={activeId} onChange={setChosenSeason} />
        <Button
          size="sm"
          variant="secondary"
          leftIcon={pending.has(`season:${season.id}`) ? undefined : CheckCheck}
          loading={pending.has(`season:${season.id}`)}
          disabled={seasonAllWatched || season.episodes.length === 0}
          onClick={markWholeSeason}
        >
          Mark season watched
        </Button>
      </div>

      {season.seasonNumber === 0 && (
        <p className="mb-2 text-xs text-fg-subtle">Specials can be ticked off but do not count toward your progress.</p>
      )}
      {actionError && (
        <p role="alert" className="mb-2 rounded-lg border border-vermilion/40 bg-vermilion/10 px-3 py-2 text-xs text-[#ff9b9b]">
          {actionError}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.ul
          key={season.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1"
        >
          {season.episodes.length === 0 && (
            <li className="rounded-lg border border-dashed border-ink-edge px-4 py-4 text-sm text-fg-muted">No episodes listed for this season yet.</li>
          )}
          {season.episodes.map((episode) => {
            const isWatched = watchedIds.has(episode.id);
            const busy = pending.has(episode.id);
            const upcoming = episode.airDate && episode.airDate > todayIso();
            return (
              <li key={episode.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isWatched}
                  aria-label={`Episode ${episode.episodeNumber}: ${episode.title}`}
                  onClick={() => toggleEpisode(episode)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    isWatched ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-ink-edge bg-ink-surface hover:border-[#3b455e]'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                      isWatched ? 'border-emerald-500 bg-emerald-500 text-ink-base' : 'border-[#3b455e] text-transparent'
                    }`}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-fg" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      <span className="mr-2 tabular-nums text-fg-subtle">{episode.episodeNumber}.</span>
                      {episode.title}
                    </span>
                    {(episode.airDate || episode.runtimeMinutes) && (
                      <span className="block text-[11px] text-fg-subtle">
                        {[formatDate(episode.airDate), episode.runtimeMinutes && `${episode.runtimeMinutes} min`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {upcoming && (
                    <span className="shrink-0 rounded-md bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber">Upcoming</span>
                  )}
                </button>
              </li>
            );
          })}
        </motion.ul>
      </AnimatePresence>
    </section>
  );
}
