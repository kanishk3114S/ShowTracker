/**
 * Converts raw AniList / TMDB objects into ONE shared media shape, so the
 * frontend never needs to know which provider a title came from.
 *
 * Rules:
 *  - Never invent data: anything the provider did not send is `null` (or `[]` for lists).
 *  - Ratings are normalized to 0-10 while `sourceRatingName` keeps the origin.
 *  - Dates are ISO `YYYY-MM-DD` only when the provider gave a complete date.
 */

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

const nullIfBlank = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Round to 1 decimal place. */
const round1 = (n) => Math.round(n * 10) / 10;

/** AniList sends descriptions with HTML (<br>, <i>...). Turn them into plain text. */
export function stripHtml(input) {
  const text = nullIfBlank(input);
  if (!text) return null;
  return (
    nullIfBlank(
      text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
    )
  );
}

/** AniList FuzzyDate {year, month, day} -> 'YYYY-MM-DD' only if all three parts exist. */
export function normalizeFuzzyDate(date) {
  if (!date?.year || !date?.month || !date?.day) return null;
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${date.year}-${mm}-${dd}`;
}

/** TMDB dates are 'YYYY-MM-DD' or '' for unknown. */
export function normalizeIsoDate(value) {
  const text = nullIfBlank(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

const yearOf = (isoDate) => (isoDate ? Number(isoDate.slice(0, 4)) : null);

/** AniList averageScore is 0-100 (null/0 = unrated). -> 0-10 with one decimal. */
export function normalizeAniListScore(score) {
  const n = numberOrNull(score);
  return n && n > 0 ? round1(n / 10) : null;
}

/** TMDB vote_average is already 0-10; ignore it when nobody has voted. */
export function normalizeTmdbScore(voteAverage, voteCount) {
  const n = numberOrNull(voteAverage);
  if (n === null || n <= 0) return null;
  if (voteCount === 0) return null;
  return round1(n);
}

const titleFallback = (...candidates) => candidates.map(nullIfBlank).find(Boolean) ?? null;

// ---------------------------------------------------------------- AniList ---

export function normalizeAniListMedia(raw) {
  if (!raw || raw.id == null) return null;
  const releaseDate = normalizeFuzzyDate(raw.startDate);
  const title = titleFallback(raw.title?.english, raw.title?.romaji, raw.title?.native);
  const originalTitle = titleFallback(raw.title?.native, raw.title?.romaji);

  const media = {
    provider: 'ANILIST',
    externalId: String(raw.id),
    mediaType: 'ANIME',

    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : null,
    overview: stripHtml(raw.description),

    posterUrl: nullIfBlank(raw.coverImage?.extraLarge) ?? nullIfBlank(raw.coverImage?.large),
    backdropUrl: nullIfBlank(raw.bannerImage),

    releaseDate,
    releaseYear: yearOf(releaseDate) ?? numberOrNull(raw.startDate?.year) ?? numberOrNull(raw.seasonYear),

    genres: Array.isArray(raw.genres) ? raw.genres.filter(Boolean) : [],

    sourceRating: normalizeAniListScore(raw.averageScore),
    sourceRatingName: 'AniList',
    popularity: numberOrNull(raw.popularity),

    totalEpisodes: numberOrNull(raw.episodes),
    totalSeasons: null,
    runtimeMinutes: numberOrNull(raw.duration),
    status: nullIfBlank(raw.status),
    format: nullIfBlank(raw.format),
    season: nullIfBlank(raw.season),

    sourceUrl: nullIfBlank(raw.siteUrl) ?? `https://anilist.co/anime/${raw.id}`
  };

  // Detail-only extras (present only when the detail query was used).
  if (raw.endDate !== undefined) media.endDate = normalizeFuzzyDate(raw.endDate);
  if (raw.studios) media.studios = raw.studios.nodes?.map((s) => s.name).filter(Boolean) ?? [];
  if (raw.relations) {
    media.relations = (raw.relations.edges ?? [])
      .filter((edge) => edge?.node?.type === 'ANIME')
      .slice(0, 12)
      .map((edge) => ({
        provider: 'ANILIST',
        externalId: String(edge.node.id),
        mediaType: 'ANIME',
        relationType: nullIfBlank(edge.relationType),
        title: titleFallback(edge.node.title?.english, edge.node.title?.romaji),
        format: nullIfBlank(edge.node.format),
        posterUrl: nullIfBlank(edge.node.coverImage?.large)
      }));
  }
  return media;
}

// ------------------------------------------------------------------- TMDB ---

const tmdbImage = (base, path) => {
  const p = nullIfBlank(path);
  return p ? `${base}${p}` : null;
};

/**
 * @param {object} raw     TMDB movie/tv object (list item or detail)
 * @param {'MOVIE'|'TV'} mediaType
 * @param {Map<number,string>} [genreMap]  id -> name, used for list items that only carry `genre_ids`
 */
export function normalizeTmdbMedia(raw, mediaType, genreMap = new Map()) {
  if (!raw || raw.id == null) return null;
  const isMovie = mediaType === 'MOVIE';

  const releaseDate = normalizeIsoDate(isMovie ? raw.release_date : raw.first_air_date);
  const title = titleFallback(isMovie ? raw.title : raw.name, isMovie ? raw.original_title : raw.original_name);
  const originalTitle = nullIfBlank(isMovie ? raw.original_title : raw.original_name);

  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g) => g.name).filter(Boolean)
    : (raw.genre_ids ?? []).map((id) => genreMap.get(id)).filter(Boolean);

  const media = {
    provider: 'TMDB',
    externalId: String(raw.id),
    mediaType,

    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : null,
    overview: nullIfBlank(raw.overview),

    posterUrl: tmdbImage(TMDB_POSTER_BASE, raw.poster_path),
    backdropUrl: tmdbImage(TMDB_BACKDROP_BASE, raw.backdrop_path),

    releaseDate,
    releaseYear: yearOf(releaseDate),

    genres,

    sourceRating: normalizeTmdbScore(raw.vote_average, raw.vote_count),
    sourceRatingName: 'TMDB',
    popularity: numberOrNull(raw.popularity),

    totalEpisodes: isMovie ? null : numberOrNull(raw.number_of_episodes),
    totalSeasons: isMovie ? null : numberOrNull(raw.number_of_seasons),
    runtimeMinutes: isMovie
      ? numberOrNull(raw.runtime) || null
      : numberOrNull(Array.isArray(raw.episode_run_time) ? raw.episode_run_time[0] : null) || null,
    status: nullIfBlank(raw.status),
    format: null,
    season: null,

    sourceUrl: `https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${raw.id}`
  };

  if (raw.tagline !== undefined) media.tagline = nullIfBlank(raw.tagline);
  if (!isMovie && raw.last_air_date !== undefined) media.endDate = normalizeIsoDate(raw.last_air_date);
  return media;
}

// ------------------------------------------------- seasons and episodes ---

const positiveIntOrNull = (value) => (Number.isInteger(value) && value > 0 ? value : null);

/** TMDB season summary (from the TV details `seasons` array or a season response). */
export function normalizeTmdbSeason(raw) {
  if (!raw || !Number.isInteger(raw.season_number) || raw.season_number < 0) return null;
  const count = Number.isInteger(raw.episode_count) ? raw.episode_count : raw.episodes?.length;
  return {
    seasonNumber: raw.season_number,
    name: nullIfBlank(raw.name) ?? (raw.season_number === 0 ? 'Specials' : `Season ${raw.season_number}`),
    overview: nullIfBlank(raw.overview),
    posterUrl: tmdbImage(TMDB_POSTER_BASE, raw.poster_path),
    airDate: normalizeIsoDate(raw.air_date),
    episodeCount: Number.isInteger(count) && count >= 0 ? count : null
  };
}

/** TMDB episode. Blank titles become "Episode N" so the NOT NULL title column is always valid. */
export function normalizeTmdbEpisode(raw) {
  const episodeNumber = positiveIntOrNull(raw?.episode_number);
  if (!episodeNumber) return null;
  return {
    episodeNumber,
    title: nullIfBlank(raw.name) ?? `Episode ${episodeNumber}`,
    overview: nullIfBlank(raw.overview),
    airDate: normalizeIsoDate(raw.air_date),
    runtimeMinutes: positiveIntOrNull(raw.runtime)
  };
}

export const MAX_GENERATED_EPISODES = 2000;

/** AniList has no per-episode data, so episodes 1..N are generated (titled "Episode N"). */
export function buildAnimeEpisodes(count, runtimeMinutes = null) {
  const n = Math.min(positiveIntOrNull(count) ?? 0, MAX_GENERATED_EPISODES);
  return Array.from({ length: n }, (_, i) => ({
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    overview: null,
    airDate: null,
    runtimeMinutes: positiveIntOrNull(runtimeMinutes)
  }));
}

/**
 * Episodes AniList can vouch for: the official count, or (for a show still
 * airing with no total yet) the number of episodes already aired.
 */
export function anilistKnownEpisodeCount(raw) {
  if (positiveIntOrNull(raw?.episodes)) return raw.episodes;
  const next = raw?.nextAiringEpisode?.episode;
  return Number.isInteger(next) && next > 1 ? next - 1 : null;
}

/** Normalize a page of provider results and drop entries that could not be normalized. */
export const compact = (items) => items.filter(Boolean);

export default {
  stripHtml,
  normalizeFuzzyDate,
  normalizeIsoDate,
  normalizeAniListScore,
  normalizeTmdbScore,
  normalizeAniListMedia,
  normalizeTmdbMedia,
  compact
};
