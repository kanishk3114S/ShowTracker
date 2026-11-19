import { z } from 'zod';

// Treat empty query-string values (?genre=&year=) as "not provided".
const emptyToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const optional = (schema) => z.preprocess(emptyToUndefined, schema.optional());

const pageSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int('page must be a whole number.').min(1).max(500, 'page cannot exceed 500.').default(1)
);

export const MEDIA_TYPES = ['ANIME', 'MOVIE', 'TV'];

const typeSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toUpperCase() || undefined : v),
  z.enum(['ALL', ...MEDIA_TYPES]).default('ALL')
);

// Genre names are matched in application code against provider lists; never used as SQL or identifiers.
// Accepts one name ("Action") or a comma-separated list ("Action,Comedy", max 5) meaning "any of these".
const GENRE_NAME = /^[\p{L}\p{N} &'\-]{1,40}$/u;
const genreSchema = optional(
  z
    .string()
    .trim()
    .max(250)
    .transform((value) => value.split(',').map((g) => g.trim()).filter(Boolean))
    .refine((names) => names.length > 0 && names.length <= 5, { message: 'Choose between 1 and 5 genres.' })
    .refine((names) => names.every((n) => GENRE_NAME.test(n)), { message: 'genre contains unsupported characters.' })
);

const yearSchema = optional(z.coerce.number().int().min(1900).max(2100));

export const searchQuerySchema = z.object({
  q: optional(z.string().trim().min(2, 'Search text must be at least 2 characters.').max(100)),
  type: typeSchema,
  page: pageSchema,
  genre: genreSchema,
  year: yearSchema
});

export const trendingQuerySchema = z.object({
  type: typeSchema,
  window: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() || undefined : v),
    z.enum(['day', 'week']).default('week')
  ),
  page: pageSchema
});

export const genresQuerySchema = z.object({
  type: typeSchema
});

// TVMAZE and TVDB titles appear when TMDB cannot serve lists (see fallbackLists.service.js)
const VALID_PAIRS = { ANILIST: ['ANIME'], TMDB: ['MOVIE', 'TV'], TVMAZE: ['TV'], TVDB: ['MOVIE', 'TV'] };

export const detailsParamsSchema = z
  .object({
    provider: z.string().trim().toUpperCase().pipe(z.enum(['ANILIST', 'TMDB', 'TVMAZE', 'TVDB'])),
    mediaType: z.string().trim().toUpperCase().pipe(z.enum(MEDIA_TYPES)),
    externalId: z.string().trim().regex(/^\d{1,10}$/, 'externalId must be a numeric provider id.')
  })
  .refine((v) => VALID_PAIRS[v.provider].includes(v.mediaType), {
    message: 'That provider does not serve this media type (ANILIST: ANIME; TMDB: MOVIE or TV; TVMAZE: TV; TVDB: MOVIE or TV).',
    path: ['mediaType']
  });

export const franchiseParamsSchema = z.object({
  externalId: z.string().regex(/^[1-9]\d{0,8}$/, 'Must be a numeric AniList id.')
});

export const seasonsParamsSchema = z.object({ mediaId: z.string().uuid('mediaId must be a valid id.') });

export const detailsQuerySchema = z.object({
  refresh: z.preprocess((v) => v === '1' || v === 'true', z.boolean())
});
