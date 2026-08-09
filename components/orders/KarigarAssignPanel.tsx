'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiPost } from '@/hooks/use-api';

export type KarigarAssignItem = {
  id: string;
  label: string;
  karigarCode: string | null;
  customisedOrderId: string | null;
  customisedOrderNumber: string | null;
};

type Karigar = { id: string; code: string };

/**
 * Manufacturer-only item multi-select + Karigar assignment, embedded in a
 * Catalog/Kiosk order's expanded detail. Only items with no customisedOrderId
 * yet are selectable — an already-assigned item shows its JFC-#### number
 * instead of a checkbox. Selecting a "Filter by Karigar Code" value
 * auto-checks every unassigned item whose product already carries that code.
 *
 * Retailer Admin / Store Manager never see this — manufacturer-only feature.
 */
export function KarigarAssignPanel({
  orderId,
  source,
  items,
  onAssigned,
}: {
  orderId: string;
  source: 'b2b' | 'kiosk';
  items: KarigarAssignItem[];
  onAssigned: (customisedOrderId: string, customisedOrderNumber: string) => void;
}) {
  const [karigars, setKarigars] = useState<Karigar[] | null>(null);
  const [orderCodes, setOrderCodes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCode, setFilterCode] = useState('');
  const [karigarId, setKarigarId] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpointBase = source === 'kiosk' ? '/api/manufacturer/kiosk-orders' : '/api/manufacturer/orders';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [karigarRes, codesRes] = await Promise.all([
        fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' }),
        fetch(`${endpointBase}/${orderId}/karigar-codes`, { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      if (cancelled) return;
      const karigarJson = (await karigarRes.json()) as { data?: Karigar[] };
      const codesJson = (await codesRes.json()) as { data?: string[] };
      setKarigars(karigarJson.data ?? []);
      setOrderCodes(codesJson.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [orderId, endpointBase]);

  const unassigned = useMemo(() => items.filter((i) => !i.customisedOrderId), [items]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function applyFilter(code: string) {
    setFilterCode(code);
    if (!code) return;
    setSelected(new Set(unassigned.filter((i) => i.karigarCode === code).map((i) => i.id)));
  }

  async function addKarigar() {
    const code = newCode.trim();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const created = (await apiPost('/api/manufacturer/karigars', { code })) as Karigar;
      setKarigars((prev) => [...(prev ?? []), created].sort((a, b) => a.code.localeCompare(b.code)));
      setKarigarId(created.id);
      setNewCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add Karigar');
    } finally {
      setBusy(false);
    }
  }

  async function removeKarigar(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manufacturer/karigars/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to remove Karigar');
      setKarigars((prev) => (prev ?? []).filter((k) => k.id !== id));
      if (karigarId === id) setKarigarId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove Karigar');
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (selected.size === 0) { setError('Select at least one item.'); return; }
    if (!karigarId) { setError('Choose a Karigar.'); return; }
    setBusy(true);
    setError(null);
    try {
      const karigar = karigars?.find((k) => k.id === karigarId) ?? null;
      const created = (await apiPost(`${endpointBase}/${orderId}/assign-karigar`, {
        itemIds: [...selected],
        karigarId,
        karigarCode: karigar?.code ?? null,
      })) as { id: string; orderNumber: string };
      setSelected(new Set());
      onAssigned(created.id, created.orderNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign Karigar');
    } finally {
      setBusy(false);
    }
  }

  if (unassigned.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Assign Karigar</p>

      {orderCodes.length > 0 && (
        <select
          className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs sm:w-auto"
          value={filterCode}
          onChange={(e) => applyFilter(e.target.value)}
        >
          <option value="">Filter by Karigar Code…</option>
          {orderCodes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <div className="space-y-1">
        {unassigned.map((it) => (
          <label key={it.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
            <span className="flex-1 truncate">{it.label}</span>
            {it.karigarCode && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{it.karigarCode}</span>}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-white px-2 text-xs"
          value={karigarId}
          onChange={(e) => setKarigarId(e.target.value)}
        >
          <option value="">Choose Karigar…</option>
          {(karigars ?? []).map((k) => <option key={k.id} value={k.id}>{k.code}</option>)}
        </select>
        {karigarId && (
          <button type="button" className="text-[11px] text-red-600 underline" disabled={busy} onClick={() => void removeKarigar(karigarId)}>
            Remove this code
          </button>
        )}
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="+ Add new Karigar Code"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="h-8 w-40 rounded-md border border-input bg-white px-2 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={busy || !newCode.trim()} onClick={() => void addKarigar()}>Add</Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="button" size="sm" disabled={busy || selected.size === 0 || !karigarId} onClick={() => void assign()} className="metal-sheen text-[#17120b] font-semibold">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Assign ${selected.size || ''} item${selected.size === 1 ? '' : 's'}`}
      </Button>
    </div>
  );
}
