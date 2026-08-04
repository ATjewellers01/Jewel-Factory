'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Thrown by apiPost/apiSend on a failed request. `fields` (path -> message)
 * is present when the server rejected specific form fields (see
 * lib/api/validation.ts's jsonValidator) — forms use it to show the error
 * under the exact input that failed instead of one generic banner.
 */
export class ApiError extends Error {
  fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields;
  }
}

/** Fetch a GET endpoint returning the { data } envelope. Redirects to loginPath on 401. */
export function useApi<T>(path: string, loginPath?: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401 && loginPath) {
        window.location.assign(loginPath);
        return;
      }
      const json = (await res.json()) as { data?: T; error?: { message: string } };
      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'Failed to load');
        return;
      }
      setData(json.data ?? null);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [path, loginPath]);

  useEffect(() => { void load(); }, [load]);

  return { data, error, loading, reload: load };
}

type ApiEnvelope = { data?: unknown; error?: { message: string; fields?: Record<string, string> } };

function throwIfError(json: ApiEnvelope | null): asserts json is { data?: unknown } {
  if (json && 'error' in json && json.error) {
    throw new ApiError(json.error.message, json.error.fields);
  }
}

export async function apiPost(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope | null;
  if (!res.ok && !(json && 'error' in json && json.error)) throw new ApiError('Request failed');
  throwIfError(json);
  return json?.data;
}

export async function apiSend(method: 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope | null;
  if (!res.ok && !(json && 'error' in json && json.error)) throw new ApiError('Request failed');
  throwIfError(json);
  return json?.data;
}
