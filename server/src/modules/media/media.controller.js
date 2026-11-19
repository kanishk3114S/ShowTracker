import { AppError } from '../../middleware/errorHandler.js';
import {
  searchMedia,
  getTrendingMedia,
  getMediaDetails,
  getGenreOptions
} from '../../services/mediaCatalog.service.js';
import { getSeasonsForMedia } from '../../services/episodeCatalog.service.js';
import { getFranchiseSummary } from '../../services/franchise.service.js';
import {
  seasonsParamsSchema,
  franchiseParamsSchema,
  searchQuerySchema,
  trendingQuerySchema,
  genresQuerySchema,
  detailsParamsSchema,
  detailsQuerySchema
} from './media.validation.js';

function parseOrThrow(schema, input, message = 'Validation failed.') {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(message, 400, 'VALIDATION_ERROR', details);
  }
  return result.data;
}

// Provider data is public and not user-specific, so shared caches may keep it briefly.
const PUBLIC_CACHE = 'public, max-age=60';

/** Surfaces "try again in N seconds" to HTTP clients as a standard header. */
const withRetryHeader = (res, err) => {
  if (err?.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
  return err;
};

export async function search(req, res, next) {
  try {
    const params = parseOrThrow(searchQuerySchema, req.query, 'Invalid search parameters.');
    const data = await searchMedia(params);
    res.set('Cache-Control', PUBLIC_CACHE).json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}

export async function trending(req, res, next) {
  try {
    const params = parseOrThrow(trendingQuerySchema, req.query, 'Invalid trending parameters.');
    const data = await getTrendingMedia(params);
    res.set('Cache-Control', PUBLIC_CACHE).json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}

export async function genres(req, res, next) {
  try {
    const params = parseOrThrow(genresQuerySchema, req.query, 'Invalid genre parameters.');
    const data = await getGenreOptions(params);
    res.set('Cache-Control', PUBLIC_CACHE).json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}

export async function seasons(req, res, next) {
  try {
    const { mediaId } = parseOrThrow(seasonsParamsSchema, req.params, 'Invalid media id.');
    const data = await getSeasonsForMedia(mediaId);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}

/** Is this anime one season of a longer series (and which one)? Public, derived from AniList relations. */
export async function franchise(req, res, next) {
  try {
    const { externalId } = parseOrThrow(franchiseParamsSchema, req.params, 'Invalid anime id.');
    const data = await getFranchiseSummary(externalId);
    res.set('Cache-Control', 'public, max-age=300').json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}

export async function details(req, res, next) {
  try {
    const params = parseOrThrow(detailsParamsSchema, req.params, 'Invalid media identifier.');
    const { refresh } = parseOrThrow(detailsQuerySchema, req.query);
    const data = await getMediaDetails({ ...params, refresh });
    res.set('Cache-Control', PUBLIC_CACHE).json({ success: true, data });
  } catch (err) {
    next(withRetryHeader(res, err));
  }
}
