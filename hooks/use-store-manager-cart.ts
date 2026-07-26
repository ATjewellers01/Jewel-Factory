'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type StoreManagerCartItem = {
  productId: string;
  name: string;
  designNumber?: string;
  imageUrl?: string;
  quantity: number;
};

type StoredCart = { items: StoreManagerCartItem[]; note: string };

const EVENT = 'jf_store_manager_cart_change';

function cartKey(kind: 'kiosk' | 'restock', branchId: string) {
  return `jf_store_manager_${kind}_cart:${branchId}`;
}

function read(key: string): StoredCart {
  if (typeof window === 'undefined') return { items: [], note: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<StoredCart> | null;
    return {
      items: Array.isArray(stored?.items) ? stored.items : [],
      note: typeof stored?.note === 'string' ? stored.note : '',
    };
  } catch {
    return { items: [], note: '' };
  }
}

function write(key: string, value: StoredCart) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/**
 * Browser-persisted, branch-scoped order cart for the Store Manager portal.
 * Kiosk/Search and Restock intentionally use different keys: customer orders
 * must never mix with PIN-protected stock orders.
 */
function useStoreManagerCart(kind: 'kiosk' | 'restock', branchId: string) {
  const key = useMemo(() => cartKey(kind, branchId), [branchId, kind]);
  const [cart, setCart] = useState<StoredCart>({ items: [], note: '' });

  useEffect(() => {
    const sync = () => setCart(read(key));
    sync();
    const onChange = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail === key) sync();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) sync();
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);

  const add = useCallback((item: Omit<StoreManagerCartItem, 'quantity'>, quantity = 1) => {
    const current = read(key);
    const existing = current.items.find((line) => line.productId === item.productId);
    const items = existing
      ? current.items.map((line) => line.productId === item.productId
        ? { ...line, ...item, quantity: line.quantity + quantity }
        : line)
      : [...current.items, { ...item, quantity }];
    write(key, { ...current, items });
  }, [key]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const current = read(key);
    const items = quantity <= 0
      ? current.items.filter((line) => line.productId !== productId)
      : current.items.map((line) => line.productId === productId ? { ...line, quantity } : line);
    write(key, { ...current, items });
  }, [key]);

  const setNote = useCallback((note: string) => {
    write(key, { ...read(key), note });
  }, [key]);

  const clear = useCallback(() => write(key, { items: [], note: '' }), [key]);
  const count = cart.items.reduce((total, line) => total + line.quantity, 0);

  return { items: cart.items, note: cart.note, count, add, setQuantity, setNote, clear };
}

export function useStoreManagerKioskCart(branchId: string) {
  return useStoreManagerCart('kiosk', branchId);
}

export function useStoreManagerRestockCart(branchId: string) {
  return useStoreManagerCart('restock', branchId);
}
