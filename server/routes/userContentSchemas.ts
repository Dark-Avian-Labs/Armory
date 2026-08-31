import { z } from 'zod';

import { MAX_NAME_LENGTH } from './apiShared.js';

export const UserContentNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);

export const LoadoutCreateBodySchema = z.object({
  name: UserContentNameSchema,
});

export const LoadoutUpdateBodySchema = z
  .object({
    name: UserContentNameSchema.optional(),
    visibility: z.enum(['public', 'private', 'unlisted']).optional(),
    description: z.unknown().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.visibility !== undefined || value.description !== undefined,
    { message: 'Provide at least name, visibility, or description' },
  );

export const BuildUpdateBodySchema = z.object({
  name: UserContentNameSchema,
  mod_config: z.unknown(),
  visibility: z.unknown().optional(),
  description: z.unknown().optional(),
});

export function loadoutUpdateErrorMessage(error: z.ZodError): string {
  for (const issue of error.issues) {
    if (issue.path[0] === 'name') return 'Invalid name';
    if (issue.path[0] === 'visibility') return 'Invalid visibility';
  }
  return 'Provide at least name, visibility, or description';
}
