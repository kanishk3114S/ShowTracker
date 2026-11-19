import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';

/**
 * Anime franchise link on a title page.
 *  - opened a sequel directly: "Part of <series> (Season 2) · View Full Series" -> the first season,
 *    which is where the unified seasons live
 *  - opened the first season of a multi-season series: a quiet summary with the other seasons
 * Renders nothing for movies, TV, standalone anime, or while/if the lookup is unavailable.
 */
export default function FranchiseBadge({ media }) {
  const eligible = media?.provider === 'ANILIST' && media?.mediaType === 'ANIME' && Boolean(media?.externalId);
  const { data } = useResource(R.franchise(media?.externalId ?? 0), { enabled: eligible });
  if (!eligible || !data?.isFranchise) return null;

  if (!data.isRoot && data.root) {
    return (
      <Link
        to={`/media/anilist/anime/${data.root.externalId}`}
        className="group mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-2 text-sm text-fg transition hover:border-accent/60 hover:bg-accent/[0.12]"
      >
        <Layers className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 truncate">
          Part of <span className="font-semibold">{data.root.title}</span> (Season {data.seasonNumber})
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent">
          View Full Series <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    );
  }

  return (
    <div className="mt-4 max-w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
        <Layers className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="font-semibold text-fg">{data.totalSeasons} seasons</span>
        <span className="font-mono text-xs tabular-nums">{data.totalEpisodes} episodes in one series</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Seasons of this series">
        {data.members.map((m) => (
          <li key={m.externalId}>
            {m.seasonNumber === data.seasonNumber ? (
              <span className="inline-flex rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent" aria-current="page">
                S{m.seasonNumber}
              </span>
            ) : (
              <Link
                to={`/media/anilist/anime/${m.externalId}`}
                title={m.title}
                className="inline-flex rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-fg-muted transition hover:border-white/25 hover:text-fg"
              >
                S{m.seasonNumber}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
