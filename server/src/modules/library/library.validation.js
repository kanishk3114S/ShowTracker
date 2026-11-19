import { z } from 'zod';
import { cleanText } from '../../utils/sanitize.js';

export const LIBRARY_STATUSES = ['PLAN_TO_WATCH', 'WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'REWATCHING'];

const uuid = z.string().uuid('Must be a valid id.');

/** Rating 0-10 with at most one decimal (matches NUMERIC(3,1)). */
const ratingSchema = z
  .number({ error: 'Rating must be a number between 0 and 10.' })
  .min(0, 'Rating cannot be below 0.')
  .max(10, 'Rating cannot be above 10.')
  .transform((n) => Math.round(n * 10) / 10);

const notesSchema = z.string().transform(cleanText).pipe(z.string().max(2000, 'Notes cannot exceed 2000 characters.'));

export const addLibrarySchema = z.object({
  mediaId: uuid,
  status: z.enum(LIBRARY_STATUSES).default('PLAN_TO_WATCH'),
  rating: ratingSchema.nullable().optional(),
  isFavorite: z.boolean().optional(),
  notes: notesSchema.nullable().optional()
});

export const updateLibrarySchema = z
  .object({
    status: z.enum(LIBRARY_STATUSES).optional(),
    rating: ratingSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    notes: notesSchema.nullable().optional()
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update.'
  });

const emptyToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const listLibraryQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(LIBRARY_STATUSES).optional()),
  mediaType: z.preprocess(emptyToUndefined, z.enum(['ANIME', 'MOVIE', 'TV']).optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(['updated_at', 'title', 'rating', 'release_date']).default('updated_at')),
  order: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc')),
  groupId: z.preprocess(emptyToUndefined, uuid.optional())
});

export const entryParamsSchema = z.object({ id: uuid });
export const mediaParamsSchema = z.object({ mediaId: uuid });
export const episodeParamsSchema = z.object({ id: uuid, episodeId: uuid });
export const seasonParamsSchema = z.object({ id: uuid, seasonId: uuid });
