'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
 * A custom dropdown (not a native <select>) — needed so each row can carry
 * its own inline "×" remove button (native <option> can't hold interactive
 * elements), and so picking "More…" expands the list in place instead of
 * closing the dropdown the way a native <select> does on every selection.
 *
 * `codes`: only the Karigar codes present among this order's items (or, for
 * a Retailer-Admin bespoke request with no linked items, the full list —
 * the caller decides). `allCodes`: the manufacturer's ENTIRE master-list,
 * revealed via "More…" — lets the manufacturer assign to a Karigar other
 * than whichever one(s) already appear on this order's products (e.g. the
 * product's usual Karigar left the company). "More…" always shows whenever
 * a full list is available, even if it happens to match the filtered list
 * exactly right now — the manufacturer can't tell that in advance.
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
  const [open, setOpen] = useState(false);
  const [karigarId, setKarigarId] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const visible = showAll && allCodes ? allCodes : codes;
  const selected = visible.find((k) => k.id === karigarId) ?? null;
  const hasMore = !showAll && !!allCodes;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function pick(karigar: Karigar) {
    setKarigarId(karigar.id);
    onPick(karigar);
    setOpen(false);
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
      pick(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add Karigar');
    } finally {
      setBusy(false);
    }
  }

  async function removeCode(karigar: Karigar, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove Karigar code "${karigar.code}"? This clears it from any product/order using it.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manufacturer/karigars/${karigar.id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to remove Karigar');
      if (karigarId === karigar.id) { setKarigarId(''); onPick(null); }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to remove Karigar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" ref={rootRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 min-w-40 items-center justify-between gap-2 rounded-md border border-input bg-white px-2 text-xs"
        >
          <span className={selected ? '' : 'text-muted-foreground'}>{selected ? selected.code : 'Choose Karigar…'}</span>
          <span className="text-muted-foreground">▾</span>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border bg-card shadow-lg">
            {adding ? (
              <div className="flex items-center gap-1.5 p-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="New Karigar code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmAdd(); if (e.key === 'Escape') setAdding(false); }}
                  className="h-8 flex-1 rounded-md border border-input bg-white px-2 text-xs"
                />
                <Button type="button" size="sm" className="h-8 px-2 text-xs" disabled={busy || !newCode.trim()} onClick={() => void confirmAdd()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto py-1">
                  {visible.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No Karigar codes yet.</p>}
                  {visible.map((k) => (
                    <div
                      key={k.id}
                      onClick={() => pick(k)}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 cursor-pointer ${k.id === karigarId ? 'bg-muted/40 font-medium' : ''}`}
                    >
                      <span className="truncate">{k.code}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => void removeCode(k, e)}
                        aria-label={`Remove ${k.code}`}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t py-1">
                  {hasMore && (
                    <button type="button" onClick={() => setShowAll(true)} className="block w-full px-3 py-1.5 text-left text-xs text-primary hover:bg-muted/50">
                      More…
                    </button>
                  )}
                  <button type="button" onClick={() => setAdding(true)} className="block w-full px-3 py-1.5 text-left text-xs text-primary hover:bg-muted/50">
                    + Add new Karigar Code…
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
