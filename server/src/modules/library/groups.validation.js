import { z } from 'zod';

/** Badge colour tokens a shelf can use (the client maps each one to a theme). */
export const GROUP_COLORS = ['amber', 'rose', 'cyan', 'purple', 'pink', 'emerald', 'sky', 'zinc'];
export const MAX_GROUPS_PER_USER = 50;

const uuid = z.string().uuid('Must be a valid id.');

const nameSchema = z
  .string({ error: 'Name is required.' })
  .transform((v) => v.trim().replace(/\s+/g, ' '))
  .refine((v) => v.length > 0, { message: 'Name cannot be empty.' })
  .refine((v) => v.length <= 60, { message: 'Name cannot exceed 60 characters.' });

const descriptionSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length <= 200, { message: 'Description cannot exceed 200 characters.' })
  .transform((v) => (v === '' ? null : v))
  .nullable();

const colorSchema = z.enum(GROUP_COLORS, { error: `Color must be one of: ${GROUP_COLORS.join(', ')}.` });

export const createGroupSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
  color: colorSchema.optional()
});

export const updateGroupSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    color: colorSchema.optional()
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update.'
  });

export const groupParamsSchema = z.object({ id: uuid });
export const groupItemBodySchema = z.object({ libraryEntryId: uuid });
export const groupItemParamsSchema = z.object({ id: uuid, libraryEntryId: uuid });
export const entryGroupsParamsSchema = z.object({ libraryEntryId: uuid });
