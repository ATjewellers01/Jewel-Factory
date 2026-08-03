'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'jf_b2b_cart';

export type B2bCartItem = { productId: string; name: string; designNumber: string; imageUrl?: string; quantity: number; purity?: string };

function read(): B2bCartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(items: B2bCartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('jf_b2b_cart_change'));
}

export function useB2bCart() {
  const [items, setItems] = useState<B2bCartItem[]>([]);
  useEffect(() => {
    setItems(read());
    const h = () => setItems(read());
    window.addEventListener('jf_b2b_cart_change', h);
    return () => window.removeEventListener('jf_b2b_cart_change', h);
  }, []);

  const add = useCallback((item: Omit<B2bCartItem, 'quantity'>, qty = 1) => {
    const cur = read();
    const found = cur.find((i) => i.productId === item.productId);
    if (found) found.quantity += qty; else cur.push({ ...item, quantity: qty });
    write(cur);
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    const cur = read().map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i));
    write(cur);
  }, []);
  const setPurity = useCallback((productId: string, purity: string) => {
    write(read().map((i) => (i.productId === productId ? { ...i, purity } : i)));
  }, []);
  const remove = useCallback((productId: string) => write(read().filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => write([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, add, setQty, setPurity, remove, clear, count };
}
