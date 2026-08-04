import type { Context } from 'hono';

/**
 * Standard response envelope. Success: { data }. Failure: { error: { code, message } }.
 * `code` is a fixed union so a bad code can never ship (this was a bug in the old app).
 */
export type ErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'upstream_failed'
  | 'internal_error';

export function sendData<T>(c: Context, data: T, status = 200) {
  return c.json({ data }, status as never);
}

export function sendError(c: Context, code: ErrorCode, message: string, status = 400, fields?: Record<string, string>) {
  return c.json({ error: { code, message, ...(fields ? { fields } : {}) } }, status as never);
}
