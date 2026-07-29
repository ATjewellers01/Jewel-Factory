'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiPost, apiSend } from './use-api';

type FavoriteImg = { secureUrl: string; isPrimary: boolean };
export type FavoriteEntry = {
  id: string;
  manufacturerProductId: string;
  manufacturerProduct: {
    id: string;
    designNumber: string;
    category: string | null;
    subCategory: string | null;
    purity: string | null;
    weightGrams: string | null;
    hasTryon: boolean;
    images: FavoriteImg[];
  };
};

/** Server-backed favorites — basePath is `/api/store/favorites` (Retailer) or `/api/branch-manager/favorites` (Store Manager). */
export function useFavorites(basePath: string) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(basePath, { cache: 'no-store', credentials: 'same-origin' });
      const json = (await res.json()) as { data?: FavoriteEntry[] };
      const list = json.data ?? [];
      setEntries(list);
      setIds(new Set(list.map((e) => e.manufacturerProductId)));
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { void load(); }, [load]);

  const isFavorite = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(async (productId: string) => {
    const wasFavorite = ids.has(productId);
    setIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(productId); else next.add(productId);
      return next;
    });
    try {
      if (wasFavorite) await apiSend('DELETE', `${basePath}/${productId}`);
      else await apiPost(`${basePath}/${productId}`);
      void load();
    } catch {
      // revert optimistic update on failure
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(productId); else next.delete(productId);
        return next;
      });
    }
  }, [basePath, ids, load]);

  return { entries, isFavorite, toggle, loading, count: ids.size, reload: load };
}
