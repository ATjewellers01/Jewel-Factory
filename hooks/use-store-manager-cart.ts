'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiPost, apiSend } from './use-api';

export type StoreManagerCartItem = {
  productId: string;
  name: string;
  designNumber?: string;
  imageUrl?: string;
  quantity: number;
  purity?: string;
};

type CartRow = {
  manufacturerProductId: string;
  quantity: number;
  purity: string | null;
  manufacturerProduct: {
    designNumber: string;
    images: { secureUrl: string; isPrimary: boolean }[];
  };
};

function toItem(row: CartRow): StoreManagerCartItem {
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
 * Server-backed, branch-scoped order cart for the Store Manager portal — so
 * the same login sees the same cart on every device/browser (previously
 * localStorage-only). Kiosk and Restock intentionally use separate carts
 * (?kind=KIOSK|RESTOCK): customer orders must never mix with PIN-protected
 * stock orders.
 */
function useStoreManagerCart(kind: 'kiosk' | 'restock', branchId: string) {
  const kindParam = kind === 'restock' ? 'RESTOCK' : 'KIOSK';
  const listUrl = `/api/branch-manager/cart?kind=${kindParam}`;
  const itemUrl = (productId: string) => `/api/branch-manager/cart/${productId}?kind=${kindParam}`;
  const purityUrl = (productId: string) => `/api/branch-manager/cart/${productId}/purity?kind=${kindParam}`;
  const noteUrl = `/api/branch-manager/cart/note?kind=${kindParam}`;

  const [items, setItems] = useState<StoreManagerCartItem[]>([]);
  const [note, setNoteState] = useState('');

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await fetch(listUrl, { cache: 'no-store', credentials: 'same-origin' });
      const json = (await res.json()) as { data?: { items: CartRow[]; note: string } };
      setItems((json.data?.items ?? []).map(toItem));
      setNoteState(json.data?.note ?? '');
    } catch { /* non-critical */ }
  }, [listUrl, branchId]);

  useEffect(() => { void load(); }, [load]);

  const add = useCallback((item: Omit<StoreManagerCartItem, 'quantity'>, quantity = 1) => {
    setItems((cur) => {
      const found = cur.find((line) => line.productId === item.productId);
      if (found) return cur.map((line) => (line.productId === item.productId ? { ...line, ...item, quantity: line.quantity + quantity } : line));
      return [...cur, { ...item, quantity }];
    });
    void apiPost(itemUrl(item.productId), { quantity }).catch(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, kindParam]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((cur) => cur.filter((line) => line.productId !== productId));
      void apiSend('DELETE', itemUrl(productId)).catch(() => void load());
      return;
    }
    setItems((cur) => cur.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
    void apiSend('PATCH', itemUrl(productId), { quantity }).catch(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, kindParam]);

  const setItemPurity = useCallback((productId: string, purity: string) => {
    setItems((cur) => cur.map((line) => (line.productId === productId ? { ...line, purity } : line)));
    void apiSend('PATCH', purityUrl(productId), { purity }).catch(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, kindParam]);

  const setNote = useCallback((value: string) => {
    setNoteState(value);
    void apiSend('PUT', noteUrl, { note: value }).catch(() => void load());
  }, [noteUrl, load]);

  const clear = useCallback(() => {
    setItems([]);
    setNoteState('');
    void apiSend('DELETE', listUrl).catch(() => void load());
  }, [listUrl, load]);

  const count = items.reduce((total, line) => total + line.quantity, 0);

  return {
    items, note,
    count, add, setQuantity, setItemPurity, setNote, clear,
  };
}

export function useStoreManagerKioskCart(branchId: string) {
  return useStoreManagerCart('kiosk', branchId);
}

export function useStoreManagerRestockCart(branchId: string) {
  return useStoreManagerCart('restock', branchId);
}
