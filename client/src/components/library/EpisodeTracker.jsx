import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import ProviderErrorState from '../media/ProviderErrorState';
import Button from '../ui/Button';
import Tabs from '../ui/Tabs';
import Confetti from '../ui/Confetti';
import { useToast } from '../ui/Toast';
import ProgressBar, { progressPercent } from '../ui/ProgressBar';
import { Skeleton } from '../ui/Skeleton';
import {
  markEpisodeWatched,
  markEpisodeUnwatched,
  markSeasonWatched,
  toApiError
} from '../../services/api';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
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
export default function EpisodeTracker({ entry, mediaId, watchedIds, onLocalChange, onProgress, initialSeason }) {
  const { data, error, loading, reload } = useResource(R.seasons(mediaId));
  const [chosenSeason, setChosenSeason] = useState(null);
  const [pending, setPending] = useState(() => new Set());
  const [open, setOpen] = useState(true); // the whole episode list collapses with a height animation
  const [popped, setPopped] = useState(() => new Set()); // episodes ticked by the user this visit (they get the pop + ping)
  const [celebration, setCelebration] = useState(0); // bumps each time the last episode gets checked
  const { toast } = useToast();
  const queue = useRef(Promise.resolve());

  const seasons = data?.seasons ?? [];
  const activeId =
    seasons.find((s) => s.id === chosenSeason)?.id ??
    seasons.find((s) => initialSeason && s.seasonNumber === initialSeason)?.id ?? // opened from a sequel's page: start on that season
    (seasons.find((s) => s.seasonNumber > 0) ?? seasons[0])?.id;
  const season = seasons.find((s) => s.id === activeId);

  // Total across every regular season (a franchise has several); the entry's own number can lag behind a fresh sync.
  const seasonsTotal = seasons.reduce((n, s) => (s.seasonNumber > 0 ? n + s.episodes.length : n), 0);
  const total = seasonsTotal || (entry.totalEpisodes ?? 0);
  const watched = entry.watchedEpisodesCount ?? 0;
  const percent = progressPercent(watched, total);

  const mark = (key, ids, nextWatched, delta, request) => {
    onLocalChange(ids, nextWatched, delta); // optimistic: checkbox and progress bar flip instantly
    if (nextWatched) {
      setPopped((prev) => new Set([...prev, ...ids]));
      // the pop/ping is a one-off: forget it shortly after so it never replays when a season is revisited
      setTimeout(() => setPopped((prev) => new Set([...prev].filter((id) => !ids.includes(id)))), 1000);
    }
    if (nextWatched && total > 0 && watched < total && watched + delta >= total) setCelebration((n) => n + 1);
    setPending((prev) => new Set(prev).add(key));
    queue.current = queue.current.then(async () => {
      try {
        const summary = await request();
        onProgress(summary, ids, nextWatched);
      } catch (err) {
        onLocalChange(ids, !nextWatched, -delta); // roll back
        toast(`${toApiError(err)?.message ?? 'Could not save that change.'} Your change was undone.`);
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
  const seasonWatched = season.episodes.filter((e) => watchedIds.has(e.id)).length;
  const seasonTotal = season.episodes.length;
  // Anime franchises: every season is one linked AniList entry; its own title is worth showing
  const isFranchise = seasons.filter((s) => s.seasonNumber > 0).length > 1 && Boolean(season.externalId);
  const seasonTabs = seasons.map((s) => ({ value: s.id, label: s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}` }));

  return (
    <section className="mt-6" aria-label="Episode tracker">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="episode-panel"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold uppercase tracking-wider text-fg-subtle transition-colors hover:text-fg"
        >
          Episodes
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
        </button>
        <p className="font-mono text-sm tabular-nums text-fg" aria-live="polite">
          {total > 0 ? `${watched} / ${total} episodes watched (${percent}%)` : `${watched} watched`}
          {seasons.filter((s) => s.seasonNumber > 0).length > 1 && <span className="sr-only"> across all seasons</span>}
        </p>
      </div>
      <div className="relative mb-5">
        <ProgressBar value={watched} max={total} label="Episodes watched" />
        {celebration > 0 && (
          <span key={celebration} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
            <span className="absolute inset-y-0 left-0 w-1/3 animate-sheen rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            <Confetti className="!left-full" />
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="episode-panel"
            key="episode-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="-mx-1 overflow-hidden px-1"
          >
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

      {season.seasonNumber > 0 && seasonTotal > 0 && (
        <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5" aria-label={`Season ${season.seasonNumber} progress`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="min-w-0 truncate text-fg">
              <span className="font-semibold">Season {season.seasonNumber}</span>
              {isFranchise && season.name && <span className="ml-2 text-fg-subtle">{season.name}</span>}
            </p>
            <p className="shrink-0 font-mono tabular-nums text-fg-muted" aria-live="polite">
              {seasonWatched} / {seasonTotal} eps
            </p>
          </div>
          <ProgressBar value={seasonWatched} max={seasonTotal} label={`Season ${season.seasonNumber} progress`} size="sm" className="mt-2" />
          {isFranchise && (
            <Link
              to={`/media/anilist/anime/${season.externalId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs text-fg-subtle transition hover:text-accent"
            >
              Open this season's page <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {season.seasonNumber === 0 && (
        <p className="mb-2 text-xs text-fg-subtle">Specials can be ticked off but do not count toward your progress.</p>
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
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-200 ${
                    isWatched
                      ? 'border-accent/25 bg-accent/[0.06]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <motion.span
                    key={isWatched ? 'on' : 'off'}
                    initial={isWatched && popped.has(episode.id) ? { scale: 0.8 } : false}
                    animate={{ scale: isWatched && popped.has(episode.id) ? [0.8, 1.25, 1] : 1 }}
                    transition={{ duration: 0.38, ease: 'easeOut' }}
                    className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                      isWatched ? 'border-accent bg-accent text-ink-base' : 'border-white/25 text-transparent'
                    }`}
                  >
                    {isWatched && popped.has(episode.id) && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full ring-4 ring-emerald-500/20"
                        initial={{ scale: 1, opacity: 1 }}
                        animate={{ scale: 2.4, opacity: 0 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                      />
                    )}
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-fg" aria-hidden="true" />
                    ) : (
                      <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" />
                    )}
                  </motion.span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
