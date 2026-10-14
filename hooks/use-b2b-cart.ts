'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiPost, apiSend } from './use-api';

const BASE = '/api/store/cart';

// Every useB2bCart() call is its own independent instance (own useState/
// useEffect) — the catalogue page and the header/home page each mount one.
// Without this, one instance's mutation (e.g. adding to cart on the
// catalogue page) never reaches the other's state, so the header's
// "Cart (N)" badge went stale until that instance happened to remount.
// A same-tab CustomEvent lets every mounted instance re-fetch on any
// instance's mutation (storage events don't fire in the same tab that
// wrote them, so localStorage-based syncing wouldn't reach this case).
const CART_CHANGED_EVENT = 'jf:b2b-cart-changed';
function broadcastCartChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export type B2bCartItem = { productId: string; name: string; designNumber: string; imageUrl?: string; quantity: number; purity?: string; size?: string };

type CartRow = {
  manufacturerProductId: string;
  quantity: number;
  purity: string | null;
  size: string | null;
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
    size: row.size ?? undefined,
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

  // Re-fetch whenever ANY useB2bCart() instance on the page mutates the
  // cart — see broadcastCartChanged() above.
  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(CART_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CART_CHANGED_EVENT, onChanged);
  }, [load]);

  // Every mutator below broadcasts ONLY after its own request resolves, not
  // right alongside the optimistic setItems() — broadcasting immediately
  // raced the in-flight write: every useB2bCart() instance (including this
  // one) reacts to the broadcast by re-fetching from the server, and if that
  // GET landed before the server had processed the still-in-flight POST/
  // PATCH, it came back without the change and clobbered the optimistic
  // state straight back to "not added" (the stepper flashed, then reverted
  // to the bare "Add" button). Waiting for the write to actually land first
  // means every re-fetch it triggers sees the real, updated cart.
  const add = useCallback((item: Omit<B2bCartItem, 'quantity'>, qty = 1) => {
    setItems((cur) => {
      const found = cur.find((i) => i.productId === item.productId);
      if (found) return cur.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i));
      return [...cur, { ...item, quantity: qty }];
    });
    void apiPost(`${BASE}/${item.productId}`, { quantity: qty }).then(broadcastCartChanged, () => void load());
  }, [load]);

  const setQty = useCallback((productId: string, qty: number) => {
    const quantity = Math.max(1, qty);
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
    void apiSend('PATCH', `${BASE}/${productId}`, { quantity }).then(broadcastCartChanged, () => void load());
  }, [load]);

  const setPurity = useCallback((productId: string, purity: string) => {
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, purity } : i)));
    void apiSend('PATCH', `${BASE}/${productId}/purity`, { purity }).then(broadcastCartChanged, () => void load());
  }, [load]);

  const setSize = useCallback((productId: string, size: string) => {
    setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, size } : i)));
    void apiSend('PATCH', `${BASE}/${productId}/size`, { size }).then(broadcastCartChanged, () => void load());
  }, [load]);

  const remove = useCallback((productId: string) => {
    setItems((cur) => cur.filter((i) => i.productId !== productId));
    void apiSend('DELETE', `${BASE}/${productId}`).then(broadcastCartChanged, () => void load());
  }, [load]);

  const clear = useCallback(() => {
    setItems([]);
    setNoteState('');
    void apiSend('DELETE', BASE).then(broadcastCartChanged, () => void load());
  }, [load]);

  const setNote = useCallback((value: string) => {
    setNoteState(value);
    void apiSend('PUT', `${BASE}/note`, { note: value }).catch(() => void load());
  }, [load]);

  // Number of distinct designs in the cart, not total quantity (2026-08-24) —
  // e.g. one design at qty 2 shows "Cart (1)", not "Cart (2)".
  const count = items.length;
  return { items, note, setNote, add, setQty, setPurity, setSize, remove, clear, count, loading };
}
