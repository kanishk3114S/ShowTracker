import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import Container from '../../components/layout/Container';
import { HeroBackdrop, HeroPoster } from '../../components/media/MediaHero';
import RatingPill from '../../components/cinema/RatingPill';
import BroadcastPill from '../../components/cinema/BroadcastPill';
import FranchiseBadge from '../../components/media/FranchiseBadge';
import GenreBadges from '../../components/media/GenreBadges';
import PosterImage from '../../components/media/PosterImage';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import EmptyState from '../../components/media/EmptyState';
import LibraryTracker from '../../components/library/LibraryTracker';
import { CategoryBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Reveal } from '../../components/ui/motion';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { PROVIDER_NAMES, formatDate, formatRuntime, humanize, mediaPath } from '../../components/media/mediaUtils';

import { useDocumentHead } from '../../hooks/useDocumentHead';
import JsonLd from '../../components/common/JsonLd';
import { buildMediaJsonLd } from '../../lib/seo';
function Fact({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{value}</dd>
    </div>
  );
}

const SLOW_CODES = new Set(['REQUEST_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_UNREACHABLE', 'PROVIDER_UNAVAILABLE', 'NETWORK_ERROR']);

/**
 * A slow or unreachable provider is a hiccup, not a broken page: a small pill with a retry button,
 * instead of an error wall. Every other failure keeps the full error panel.
 */
function SlowProviderNotice({ error, provider, onRetry }) {
  if (!SLOW_CODES.has(error?.code)) return <ProviderErrorState error={error} onRetry={onRetry} />;
  const name = PROVIDER_NAMES[String(provider).toUpperCase()] ?? 'the provider';
  return (
    <div className="flex justify-center">
      <div role="status" className="glass inline-flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full px-5 py-2.5 text-sm text-fg">
        <Clock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span>
          Server is slow to reach {name}
          {error?.code === 'NETWORK_ERROR' ? ' (check your connection)' : ''}.
        </span>
        <Button size="sm" variant="primary" leftIcon={RefreshCw} onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading details">
      <Skeleton className="h-72 w-full rounded-none sm:h-96" />
      <Container className="-mt-40 flex flex-col gap-8 sm:flex-row">
        <Skeleton className="aspect-[2/3] w-40 shrink-0 rounded-xl sm:w-60" />
        <div className="flex-1 space-y-4 pt-4 sm:pt-24">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Container>
    </div>
  );
}

export default function MediaDetails() {
  const { provider, mediaType, externalId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: media, error, loading, reload } = useResource(R.details({ provider, mediaType, externalId }));
  const pageUrl = `${window.location.origin}${location.pathname}`;
  useDocumentHead({
    title: media ? `${media.title}${media.releaseYear ? ` (${media.releaseYear})` : ''} — ShowTracker` : undefined,
    description: media?.overview ? media.overview.replace(/\s+/g, ' ').slice(0, 200) : undefined,
    image: media?.backdropUrl || media?.posterUrl || undefined,
    type: media ? (media.mediaType === 'MOVIE' ? 'video.movie' : 'video.tv_show') : 'website'
  });
  const jsonLd = useMemo(() => buildMediaJsonLd(media, { url: pageUrl }), [media, pageUrl]);

  if (loading && !media) return <DetailsSkeleton />;

  if (error) {
    return (
      <Container className="max-w-3xl py-16">
        {error.code === 'MEDIA_NOT_FOUND' || error.status === 400 ? (
          <EmptyState
            title="Title not found"
            message={error.message}
            action={
              <Button as={Link} to="/explore" variant="secondary">
                Back to Explore
              </Button>
            }
          />
        ) : (
          <SlowProviderNotice error={error} provider={provider} onRetry={reload} />
        )}
      </Container>
    );
  }
  if (!media) return null;

  return (
    <article className="relative">
      <JsonLd data={jsonLd} />
      <HeroBackdrop media={media} />

      <Container className="-mt-44 sm:-mt-52">
        <nav aria-label="Breadcrumb" className="relative mb-5 flex items-center justify-between gap-3 text-xs text-fg-muted">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li><Link to="/explore" className="transition hover:text-fg">Explore</Link></li>
            <li aria-hidden="true">/</li>
            <li className="truncate text-fg" aria-current="page">{media.title}</li>
          </ol>
          <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/explore'))}>
            Back
          </Button>
        </nav>

        <div className="relative flex flex-col gap-8 sm:flex-row">
          <Reveal>
            <HeroPoster media={media} />
          </Reveal>

          <Reveal delay={0.08} className="min-w-0 flex-1 sm:pt-20">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge type={media.mediaType} />
              <RatingPill
                value={media.sourceRating}
                tone="plain"
                title={`${media.sourceRatingName} rating`}
                suffix={<span className="font-normal opacity-70">/ 10 {media.sourceRatingName}</span>}
              />
              <BroadcastPill media={media} variant="hero" />
            </div>

            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-5xl">
              {media.title}
              {media.releaseYear && <span className="ml-3 text-xl font-normal text-fg-subtle sm:text-2xl">({media.releaseYear})</span>}
            </h1>
            {media.originalTitle && <p className="mt-1.5 text-sm text-fg-muted">{media.originalTitle}</p>}
            {media.tagline && <p className="mt-3 text-sm italic text-fg-muted">{media.tagline}</p>}
            <FranchiseBadge media={media} />

            <div className="mt-5">
              <GenreBadges genres={media.genres} mediaType={media.mediaType} />
            </div>

            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Overview</h2>
              <p className="mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-fg/90">
                {media.overview || 'No overview is available for this title.'}
              </p>
            </div>

            <dl className="mt-7 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-line pt-6 sm:grid-cols-3">
              <Fact label={media.mediaType === 'MOVIE' ? 'Release date' : 'First aired'} value={formatDate(media.releaseDate)} />
              <Fact label="Last aired" value={formatDate(media.endDate)} />
              <Fact label="Status" value={humanize(media.status)} />
              <Fact label="Format" value={humanize(media.format)} />
              <Fact label="Episodes" value={media.totalEpisodes} />
              <Fact label="Seasons" value={media.totalSeasons} />
              <Fact label={media.mediaType === 'MOVIE' ? 'Runtime' : 'Episode length'} value={formatRuntime(media.runtimeMinutes)} />
              <Fact label="Studio" value={media.studios?.length ? media.studios.join(', ') : null} />
            </dl>

            <LibraryTracker key={`${media.provider}:${media.mediaType}:${media.externalId}`} media={media} />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {media.sourceUrl && (
                <Button as="a" href={media.sourceUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" rightIcon={ExternalLink}>
                  View on {PROVIDER_NAMES[media.dataSource ?? media.provider]}
                </Button>
              )}
              <p className="text-xs text-fg-subtle">Data and images provided by {PROVIDER_NAMES[media.dataSource ?? media.provider]}.</p>
            </div>
          </Reveal>
        </div>

        {media.relations?.length > 0 && (
          <section className="mt-16" aria-label="Related anime">
            <h2 className="mb-4 border-b border-ink-line pb-3 text-xl font-semibold tracking-tight text-fg">Related</h2>
            <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {media.relations.map((rel) => (
                <li key={rel.externalId} className="w-32 shrink-0 sm:w-36">
                  <Link to={mediaPath(rel)} className="group block">
                    <PosterImage
                      src={rel.posterUrl}
                      alt=""
                      className="aspect-[2/3] rounded-lg border border-ink-edge transition group-hover:border-[#3b455e]"
                      imgClassName="transition-transform duration-500 group-hover:scale-105"
                      fallbackLabel=""
                    />
                    <p className="mt-2 line-clamp-2 text-xs text-fg">{rel.title}</p>
                    <p className="text-[11px] text-fg-subtle">{humanize(rel.relationType)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </article>
  );
}
