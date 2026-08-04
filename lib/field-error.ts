import { ApiError } from '@/hooks/use-api';

/**
 * Pull a single field's message off a caught apiPost/apiSend error, if the
 * server rejected that specific field (see lib/api/validation.ts). Forms
 * store the raw caught error and call this per-field when rendering, e.g.:
 *   catch (e) { setErr(e); }
 *   ...
 *   <FieldError errors={toFieldErrors(fieldError(err, 'name'))} />
 */
export function fieldError(err: unknown, field: string): string | undefined {
  return err instanceof ApiError ? err.fields?.[field] : undefined;
}

/** Shorthand for the shadcn FieldError component's `errors` prop shape. */
export function toFieldErrors(message: string | undefined): Array<{ message: string }> | undefined {
  return message ? [{ message }] : undefined;
}

/**
 * Top-line fallback message for a caught error (network failure, a
 * non-field-specific rejection like "wrong password", etc). Forms show this
 * in the usual banner alongside (not instead of) per-field messages.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error ? err.message : fallback;
}
