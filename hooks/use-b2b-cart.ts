'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiPost, apiSend } from './use-api';

const BASE = '/api/store/cart';

export type B2bCartItem = { productId: string; name: string; designNumber: string; imageUrl?: string; quantity: number; purity?: string };

type CartRow = {
  manufacturerProductId: string;
  quantity: number;
  purity: string | null;
  manufacturerProduct: {
    designNumber: string;
    images: { secureUrl: string; isPrimary: boolean }[];
  };
};

function toItem(row: CartRow): B2bCartItem {
  const img = row.manufacturerProduct.images.find((i) => i.isPrimary) ?? row.manufacturerProduct.images[0];
  return {
    productId: row.manufacturerProductId,
    name: row.manufacturerProduct.designNumber,
    designNumber: row.manufacturerProduct.designNumber,
    imageUrl: img?.secureUrl,
    quantity: row.quantity,
    purity: row.purity ?? undefined,
  };
}

/**
 * Server-backed B2B (Retailer Admin) cart — so the same account sees the same
 * cart on every device/browser (previously localStorage-only, which showed a
 * different cart on mobile vs desktop for the same login).
 */
export function useB2bCart() {
  const [items, setItems] = useState<B2bCartItem[]>([]);
  const [note, setNoteState] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(BASE, { cache: 'no-store', credentials: 'same-origin' });
      const json = (await res.json()) as { data?: { items: CartRow[]; note: string } };
      setItems((json.data?.items ?? []).map(toItem));
      setNoteState(json.data?.note ?? '');
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = useCallback((item: Omit<B2bCartItem, 'quantity'>, qty = 1) => {
    setItems((cur) => {
      const found = cur.find((i) => i.productId === item.productId);
      if (found) return cur.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i));
      return [...cur, { ...item, quantity: qty }];
    });
    void apiPost(`${BASE}/${item.productId}`, { quantity: qty }).catch(() => void load());
  }, [load]);

  const setQty = useCallback((productId: string, qty: number) => {
    const quantity = Math.max(1, qty);
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
    void apiSend('PATCH', `${BASE}/${productId}`, { quantity }).catch(() => void load());
  }, [load]);

  const setPurity = useCallback((productId: string, purity: string) => {
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, purity } : i)));
    void apiSend('PATCH', `${BASE}/${productId}/purity`, { purity }).catch(() => void load());
  }, [load]);

  const remove = useCallback((productId: string) => {
    setItems((cur) => cur.filter((i) => i.productId !== productId));
    void apiSend('DELETE', `${BASE}/${productId}`).catch(() => void load());
  }, [load]);

  const clear = useCallback(() => {
    setItems([]);
    setNoteState('');
    void apiSend('DELETE', BASE).catch(() => void load());
  }, [load]);

  const setNote = useCallback((value: string) => {
    setNoteState(value);
    void apiSend('PUT', `${BASE}/note`, { note: value }).catch(() => void load());
  }, [load]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, note, setNote, add, setQty, setPurity, remove, clear, count, loading };
}
