import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

import { sendError } from './envelope';

/**
 * Same as zValidator('json', schema), except a failed validation returns our
 * standard error envelope with a `fields` map (path -> message) instead of a
 * raw ZodError dump — so every form in the app can show the error under the
 * specific field that failed, not just a generic banner.
 */
export function jsonValidator<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      return sendError(c, 'validation_failed', 'Please fix the highlighted fields.', 400, fields);
    }
  });
}
