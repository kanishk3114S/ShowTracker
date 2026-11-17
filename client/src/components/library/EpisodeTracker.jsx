import React, { useState } from 'react';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import ProviderErrorState from '../media/ProviderErrorState';
import { getMediaSeasons, markEpisodeWatched, markEpisodeUnwatched, markSeasonWatched, toApiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { formatDate } from '../media/mediaUtils';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Season/episode list with watch toggles. Progress numbers come from the server
 * (derived with COUNT(*)); this component only reflects them.
 *
 * Props:
 *  - entry:       the user's library entry (needs id, watchedEpisodesCount, totalEpisodes)
 *  - mediaId:     catalog id used to load seasons
 *  - watchedIds:  Set of watched episode ids
 *  - onProgress:  (summary, episodeIds, watched) => void, called after each successful change
 */
export default function EpisodeTracker({ entry, mediaId, watchedIds, onProgress }) {
  const { data, error, loading, reload } = useApiResource((signal) => getMediaSeasons(mediaId, signal), [mediaId]);
  const [chosenSeason, setChosenSeason] = useState(null);
  const [pending, setPending] = useState(() => new Set());
  const [actionError, setActionError] = useState(null);

  const seasons = data?.seasons ?? [];
  const activeId =
    seasons.find((s) => s.id === chosenSeason)?.id ?? (seasons.find((s) => s.seasonNumber > 0) ?? seasons[0])?.id;
  const season = seasons.find((s) => s.id === activeId);

  const total = entry.totalEpisodes ?? 0;
  const watched = entry.watchedEpisodesCount ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;

  const withPending = async (key, task) => {
    setPending((prev) => new Set(prev).add(key));
    setActionError(null);
    try {
      await task();
    } catch (err) {
      setActionError(toApiError(err)?.message ?? 'Something went wrong.');
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const toggleEpisode = (episode) =>
    withPending(episode.id, async () => {
      const isWatched = watchedIds.has(episode.id);
      const summary = isWatched
        ? await markEpisodeUnwatched(entry.id, episode.id)
        : await markEpisodeWatched(entry.id, episode.id);
      onProgress(summary, [episode.id], !isWatched);
    });

  const markSeason = () =>
    withPending(`season:${season.id}`, async () => {
      const summary = await markSeasonWatched(entry.id, season.id);
      onProgress(summary, season.episodes.map((e) => e.id), true);
    });

  if (loading && !data) {
    return (
      <div role="status" aria-label="Loading episodes" className="mt-6 animate-pulse space-y-2">
        <div className="h-4 w-1/3 rounded bg-[#1C2230]" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[#151922]" />
        ))}
      </div>
    );
  }
  if (error) return <div className="mt-6"><ProviderErrorState error={error} onRetry={reload} compact /></div>;

  if (seasons.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-[#2A3245] px-4 py-5 text-sm text-[#9CA3AF]">
        The provider has no episode list for this title yet, so episodes cannot be tracked. Check back later.
      </p>
    );
  }

  const seasonAllWatched = season.episodes.length > 0 && season.episodes.every((e) => watchedIds.has(e.id));

  return (
    <section className="mt-6" aria-label="Episode tracker">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Episodes</h3>
        <p className="text-sm text-[#E5E7EB]" aria-live="polite">
          {total > 0 ? `${watched} / ${total} watched (${percent}%)` : `${watched} watched`}
        </p>
      </div>
      <div
        className="mb-4 h-2 overflow-hidden rounded-full bg-[#1C2230]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Episodes watched"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Seasons">
          {seasons.map((s) => (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={s.id === activeId}
              onClick={() => setChosenSeason(s.id)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                s.id === activeId
                  ? 'border-red-500 bg-red-600/20 text-red-200'
                  : 'border-[#2A3245] bg-[#151922] text-[#9CA3AF] hover:text-white'
              }`}
            >
              {s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={markSeason}
          disabled={seasonAllWatched || season.episodes.length === 0 || pending.has(`season:${season.id}`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A3245] bg-[#1C2230] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2A3245] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending.has(`season:${season.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Mark season watched
        </button>
      </div>

      {season.seasonNumber === 0 && (
        <p className="mb-2 text-xs text-[#9CA3AF]">Specials can be ticked off but do not count toward your progress.</p>
      )}
      {actionError && (
        <p role="alert" className="mb-2 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {actionError}
        </p>
      )}

      <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
        {season.episodes.length === 0 && (
          <li className="rounded-lg border border-dashed border-[#2A3245] px-4 py-4 text-sm text-[#9CA3AF]">
            No episodes listed for this season yet.
          </li>
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
                disabled={busy}
                onClick={() => toggleEpisode(episode)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:opacity-60 ${
                  isWatched
                    ? 'border-emerald-800/60 bg-emerald-950/20'
                    : 'border-[#2A3245] bg-[#151922] hover:border-[#3B455E]'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                    isWatched ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-[#3B455E] text-transparent'
                  }`}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[#F3F4F6]">
                    <span className="mr-2 text-[#9CA3AF]">{episode.episodeNumber}.</span>
                    {episode.title}
                  </span>
                  {(episode.airDate || episode.runtimeMinutes) && (
                    <span className="block text-[11px] text-[#9CA3AF]">
                      {[formatDate(episode.airDate), episode.runtimeMinutes && `${episode.runtimeMinutes} min`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
                {upcoming && (
                  <span className="shrink-0 rounded-md bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-400">
                    Upcoming
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
