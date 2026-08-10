'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiPost } from '@/hooks/use-api';

export type Karigar = { id: string; code: string };

/**
 * Manufacturer-only Karigar picker (2026-08-10 redesign, extended
 * 2026-08-11) — sits on the SAME row as "Ship to", to its right. No longer a
 * separate dashed box: the per-item checkboxes live on each item row itself
 * (see the item list in app/manufacturer/orders/page.tsx), this component
 * only owns the dropdown + "Assign items" trigger.
 *
 * `codes`: only the Karigar codes present among this order's items (or, for
 * a Retailer-Admin bespoke request with no linked items, the full list —
 * the caller decides). `allCodes`: the manufacturer's ENTIRE master-list,
 * revealed via the dropdown's "More…" option — lets the manufacturer assign
 * to a Karigar other than whichever one(s) already appear on this order's
 * products (e.g. the product's usual Karigar left the company).
 */
export function KarigarPicker({
  codes,
  allCodes,
  selectedCount,
  onPick,
  onAssign,
  assignDisabled,
  assignBusy,
}: {
  codes: Karigar[];
  allCodes?: Karigar[];
  selectedCount: number;
  onPick: (karigar: Karigar | null) => void;
  onAssign: () => void;
  assignDisabled: boolean;
  assignBusy: boolean;
}) {
  const [karigarId, setKarigarId] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = showAll && allCodes ? allCodes : codes;
  const selected = visible.find((k) => k.id === karigarId) ?? null;
  const hasMore = !showAll && allCodes && allCodes.length > codes.length;

  function handleSelect(value: string) {
    if (value === '__add__') { setAdding(true); return; }
    if (value === '__more__') { setShowAll(true); return; }
    setKarigarId(value);
    onPick(visible.find((k) => k.id === value) ?? null);
  }

  async function confirmAdd() {
    const code = newCode.trim();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const created = (await apiPost('/api/manufacturer/karigars', { code })) as Karigar;
      setAdding(false);
      setNewCode('');
      setKarigarId(created.id);
      onPick(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add Karigar');
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirm(`Remove Karigar code "${selected.code}"? This clears it from any product/order using it.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manufacturer/karigars/${selected.id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to remove Karigar');
      setKarigarId('');
      onPick(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove Karigar');
    } finally {
      setBusy(false);
    }
  }

  if (adding) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          autoFocus
          type="text"
          placeholder="New Karigar code"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void confirmAdd(); if (e.key === 'Escape') setAdding(false); }}
          className="h-8 w-40 rounded-md border border-input bg-white px-2 text-xs"
        />
        <Button type="button" size="sm" className="h-8 px-2 text-xs" disabled={busy || !newCode.trim()} onClick={() => void confirmAdd()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-8 rounded-md border border-input bg-white px-2 text-xs"
        value={karigarId}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">Choose Karigar…</option>
        {visible.map((k) => <option key={k.id} value={k.id}>{k.code}</option>)}
        {hasMore && <option value="__more__">More…</option>}
        <option value="__add__">+ Add new Karigar Code…</option>
      </select>
      {selected && (
        <button type="button" disabled={busy} onClick={() => void removeSelected()} className="text-[11px] text-red-600 underline disabled:opacity-50">
          Remove
        </button>
      )}
      <Button
        type="button"
        size="sm"
        className="h-8 px-3 text-xs metal-sheen text-[#17120b] font-semibold"
        disabled={assignDisabled || selectedCount === 0}
        onClick={onAssign}
      >
        {assignBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Assign items${selectedCount ? ` (${selectedCount})` : ''}`}
      </Button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

/**
 * Fetches Karigar codes scoped to one order (filtered by its items — the
 * order-specific list, auto-synced server-side so a product-level code
 * always appears even if it was never "+ Add"ed to the master-list) AND the
 * manufacturer's full list (for the dropdown's "More…" option, #3 in the
 * 2026-08-11 follow-up — a code from elsewhere in the catalogue may still be
 * the right pick, e.g. reassigning to a different Karigar than the product's
 * own default).
 */
export function useKarigarCodes(orderId: string | null, source: 'b2b' | 'kiosk' | 'retailer-custom', filtered: boolean) {
  const [filteredCodes, setFilteredCodes] = useState<Karigar[] | null>(null);
  const [allCodes, setAllCodes] = useState<Karigar[] | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      const allRes = await fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' });
      const allJson = (await allRes.json()) as { data?: Karigar[] };
      if (cancelled) return;
      setAllCodes(allJson.data ?? []);

      if (!filtered) {
        setFilteredCodes(allJson.data ?? []);
        return;
      }
      const endpoint = source === 'kiosk' ? `/api/manufacturer/kiosk-orders/${orderId}/karigar-codes` : `/api/manufacturer/orders/${orderId}/karigar-codes`;
      const codesRes = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      const codesJson = (await codesRes.json()) as { data?: Karigar[] };
      if (!cancelled) setFilteredCodes(codesJson.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [orderId, source, filtered]);

  return { filteredCodes, allCodes };
}
