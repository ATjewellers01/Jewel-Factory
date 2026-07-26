'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'jf_guest_cart';

export type GuestCartItem = { productId: string; name: string; imageUrl?: string; quantity: number };

function read(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(items: GuestCartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('jf_guest_cart_change'));
}

export function useGuestCart() {
  const [items, setItems] = useState<GuestCartItem[]>([]);
  useEffect(() => {
    setItems(read());
    const h = () => setItems(read());
    window.addEventListener('jf_guest_cart_change', h);
    return () => window.removeEventListener('jf_guest_cart_change', h);
  }, []);

  const add = useCallback((item: Omit<GuestCartItem, 'quantity'>, qty = 1) => {
    const cur = read();
    const found = cur.find((i) => i.productId === item.productId);
    if (found) found.quantity += qty; else cur.push({ ...item, quantity: qty });
    write(cur);
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    write(read().map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i)));
  }, []);
  const remove = useCallback((productId: string) => write(read().filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => write([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, add, setQty, remove, clear, count };
}
