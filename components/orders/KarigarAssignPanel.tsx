'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiPost } from '@/hooks/use-api';

export type Karigar = { id: string; code: string };

/**
 * Manufacturer-only Karigar picker (2026-08-10 redesign) — sits on the SAME
 * row as "Ship to", to its right. No longer a separate dashed box: the
 * per-item checkboxes live on each item row itself (see the item list in
 * app/manufacturer/orders/page.tsx), this component only owns the dropdown +
 * "Assign items" trigger.
 *
 * `codes`: for a normal Catalog/Kiosk order, pass only the Karigar codes
 * present among this order's items (filtered) — picking one is handled by
 * the caller (auto-checks matching item rows). For a Retailer-Admin bespoke
 * request (no linked items), pass the manufacturer's FULL Karigar list
 * instead — there's nothing to filter by.
 */
export function KarigarPicker({
  codes,
  selectedCount,
  onPick,
  onAssign,
  assignDisabled,
  assignBusy,
}: {
  codes: Karigar[];
  selectedCount: number;
  onPick: (karigar: Karigar | null) => void;
  onAssign: () => void;
  assignDisabled: boolean;
  assignBusy: boolean;
}) {
  const [karigarId, setKarigarId] = useState('');
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(value: string) {
    if (value === '__add__') {
      setAdding(true);
      return;
    }
    setKarigarId(value);
    onPick(codes.find((k) => k.id === value) ?? null);
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
        {codes.map((k) => <option key={k.id} value={k.id}>{k.code}</option>)}
        <option value="__add__">+ Add new Karigar Code…</option>
      </select>
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

/** Fetches Karigar codes scoped to one order (filtered by its items) or the full manufacturer list. */
export function useKarigarCodes(orderId: string | null, source: 'b2b' | 'kiosk' | 'retailer-custom', filtered: boolean) {
  const [codes, setCodes] = useState<Karigar[] | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      if (!filtered) {
        const res = await fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' });
        const json = (await res.json()) as { data?: Karigar[] };
        if (!cancelled) setCodes(json.data ?? []);
        return;
      }
      const endpoint = source === 'kiosk' ? `/api/manufacturer/kiosk-orders/${orderId}/karigar-codes` : `/api/manufacturer/orders/${orderId}/karigar-codes`;
      const [codesRes, allRes] = await Promise.all([
        fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      const codesJson = (await codesRes.json()) as { data?: string[] };
      const allJson = (await allRes.json()) as { data?: Karigar[] };
      if (cancelled) return;
      const present = new Set(codesJson.data ?? []);
      setCodes((allJson.data ?? []).filter((k) => present.has(k.code)));
    })();
    return () => { cancelled = true; };
  }, [orderId, source, filtered]);

  return codes;
}
