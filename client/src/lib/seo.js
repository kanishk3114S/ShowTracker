/**
 * schema.org structured data for a title page. Only facts we actually have are included:
 * nothing is invented (no review counts, no fake dates).
 *   MOVIE        -> schema.org/Movie
 *   TV / ANIME   -> schema.org/TVSeries
 */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export function buildMediaJsonLd(media, { url } = {}) {
  if (!media?.title) return null;
  const isMovie = media.mediaType === 'MOVIE';
  const rating =
    media.sourceRating != null
      ? { '@type': 'AggregateRating', ratingValue: media.sourceRating, bestRating: 10, worstRating: 0 }
      : undefined;
  const common = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name: media.title,
    url,
    image: media.posterUrl || media.backdropUrl || undefined,
    description: media.overview || undefined,
    genre: media.genres?.length ? media.genres : undefined,
    aggregateRating: rating
  };
  if (isMovie) {
    return clean({ ...common, datePublished: media.releaseDate });
  }
  return clean({
    ...common,
    startDate: media.releaseDate,
    endDate: media.endDate,
    // an anime franchise is one series: report the whole thing when it is known
    numberOfSeasons: media.series?.totalSeasons ?? media.totalSeasons,
    numberOfEpisodes: media.totalEpisodes
  });
}

/** JSON for a <script type="application/ld+json"> body. "<" is escaped so the text can never close the tag. */
export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
