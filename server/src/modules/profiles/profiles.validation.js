import { z } from 'zod';

export const usernameRegex = /^[a-z0-9_]{3,30}$/;

export const usernameSchema = z
  .string()
  .trim()
  .transform((val) => val.toLowerCase())
  .refine((val) => usernameRegex.test(val), {
    message: 'Username must be 3-30 characters and contain only lowercase letters, numbers, and underscores.'
  });

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  display_name: z.string().trim().max(80, 'Display name cannot exceed 80 characters.').nullable().optional(),
  avatar_url: z
    .string()
    .trim()
    .url('Avatar must be a valid URL.')
    .refine((v) => /^https?:\/\//i.test(v), { message: 'Avatar must be an http(s) URL.' })
    .nullable()
    .optional()
    .or(z.literal('')),
  bio: z.string().trim().max(300, 'Bio cannot exceed 300 characters.').nullable().optional(),
  profile_visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  library_visibility: z.enum(['PUBLIC', 'PRIVATE']).optional()
});

export const checkUsernameSchema = z.object({
  username: z.string().trim()
});
