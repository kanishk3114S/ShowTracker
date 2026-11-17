import React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, ExternalLink, ImageOff } from 'lucide-react';
import LibraryTracker from '../../components/library/LibraryTracker';
import AppHeader from '../../components/layout/AppHeader';
import AppFooter from '../../components/layout/AppFooter';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import { getMediaDetails } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { TYPE_LABELS, PROVIDER_NAMES, formatDate, formatRuntime, humanize, mediaPath } from '../../components/media/mediaUtils';

function Fact({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[#6B7280]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[#F3F4F6]">{value}</dd>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading details">
      <div className="h-64 bg-[#151922] sm:h-80" />
      <div className="mx-auto -mt-32 flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:px-6">
        <div className="aspect-[2/3] w-44 shrink-0 rounded-xl border border-[#2A3245] bg-[#1C2230] sm:w-56" />
        <div className="flex-1 space-y-3 pt-8">
          <div className="h-8 w-2/3 rounded bg-[#1C2230]" />
          <div className="h-4 w-1/3 rounded bg-[#1C2230]" />
          <div className="h-24 w-full rounded bg-[#1C2230]" />
        </div>
      </div>
    </div>
  );
}

export default function MediaDetails() {
  const { provider, mediaType, externalId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: media, error, loading, reload } = useApiResource(
    (signal) => getMediaDetails({ provider, mediaType, externalId }, signal),
    [provider, mediaType, externalId]
  );

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6]">
      <AppHeader />
      {loading && !media ? (
        <DetailsSkeleton />
      ) : error ? (
        <main className="mx-auto max-w-3xl px-4 py-16">
          {error.code === 'MEDIA_NOT_FOUND' || error.status === 400 ? (
            <EmptyState
              title="Title not found"
              message={error.message}
              action={
                <Link to="/explore" className="mt-4 text-sm font-medium text-red-400 hover:text-red-300">
                  Back to Explore
                </Link>
              }
            />
          ) : (
            <ProviderErrorState error={error} onRetry={reload} />
          )}
        </main>
      ) : media ? (
        <article>
          <div className="relative h-64 overflow-hidden bg-[#151922] sm:h-80">
            {media.backdropUrl && (
              <img src={media.backdropUrl} alt="" className="h-full w-full object-cover opacity-50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/60 to-transparent" />
          </div>

          <div className="mx-auto -mt-36 max-w-6xl px-4 sm:px-6">
            <button
              type="button"
              onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/explore'))}
              className="relative mb-4 inline-flex items-center gap-1.5 text-sm text-[#D1D5DB] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="relative flex flex-col gap-6 sm:flex-row">
              <div className="w-44 shrink-0 sm:w-60">
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[#2A3245] bg-[#151922] shadow-2xl shadow-black/60">
                  {media.posterUrl ? (
                    <img src={media.posterUrl} alt={`${media.title} poster`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-[#9CA3AF]">
                      <ImageOff className="h-7 w-7" />
                      <span className="text-xs">No poster available</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 pt-2 sm:pt-20">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-[#2A3245] bg-[#1C2230] px-2 py-0.5 font-semibold uppercase tracking-wide text-[#D1D5DB]">
                    {TYPE_LABELS[media.mediaType]}
                  </span>
                  {media.sourceRating != null && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/40 px-2 py-0.5 font-semibold text-amber-400">
                      <Star className="h-3 w-3 fill-amber-400" />
                      {media.sourceRating.toFixed(1)} / 10
                      <span className="font-normal text-amber-200/70">{media.sourceRatingName}</span>
                    </span>
                  )}
                </div>

                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                  {media.title}
                  {media.releaseYear && <span className="ml-2 text-xl font-normal text-[#9CA3AF]">({media.releaseYear})</span>}
                </h1>
                {media.originalTitle && <p className="mt-1 text-sm text-[#9CA3AF]">{media.originalTitle}</p>}
                {media.tagline && <p className="mt-2 text-sm italic text-[#D1D5DB]">{media.tagline}</p>}

                {media.genres.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Genres">
                    {media.genres.map((g) => (
                      <li key={g}>
                        <Link
                          to={`/explore?type=${media.mediaType}&genre=${encodeURIComponent(g)}`}
                          className="block rounded-full border border-[#2A3245] bg-[#151922] px-3 py-1 text-xs text-[#D1D5DB] transition hover:border-red-500/60 hover:text-white"
                        >
                          {g}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Overview</h2>
                  <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-[#E5E7EB]">
                    {media.overview || 'No overview is available for this title.'}
                  </p>
                </div>

                <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Fact label={media.mediaType === 'MOVIE' ? 'Release date' : 'First aired'} value={formatDate(media.releaseDate)} />
                  <Fact label="Last aired" value={formatDate(media.endDate)} />
                  <Fact label="Status" value={humanize(media.status)} />
                  <Fact label="Format" value={humanize(media.format)} />
                  <Fact label="Episodes" value={media.totalEpisodes} />
                  <Fact label="Seasons" value={media.totalSeasons} />
                  <Fact
                    label={media.mediaType === 'MOVIE' ? 'Runtime' : 'Episode length'}
                    value={formatRuntime(media.runtimeMinutes)}
                  />
                  <Fact label="Studio" value={media.studios?.length ? media.studios.join(', ') : null} />
                </dl>

                <LibraryTracker key={`${media.provider}:${media.mediaType}:${media.externalId}`} media={media} />

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {media.sourceUrl && (
                    <a
                      href={media.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#2A3245] bg-[#1C2230] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2A3245]"
                    >
                      View on {PROVIDER_NAMES[media.provider]} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <p className="mt-3 text-xs text-[#6B7280]">
                  Data and images provided by {PROVIDER_NAMES[media.provider]}.
                </p>
              </div>
            </div>

            {media.relations?.length > 0 && (
              <section className="mt-12" aria-label="Related anime">
                <h2 className="mb-4 text-lg font-semibold text-white">Related</h2>
                <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                  {media.relations.map((rel) => (
                    <li key={rel.externalId}>
                      <Link to={mediaPath(rel)} className="group block">
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-[#2A3245] bg-[#151922] transition group-hover:border-[#3B455E]">
                          {rel.posterUrl && (
                            <img src={rel.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-[#F3F4F6]">{rel.title}</p>
                        <p className="text-[11px] text-[#9CA3AF]">{humanize(rel.relationType)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      ) : null}
      <AppFooter />
    </div>
  );
}
