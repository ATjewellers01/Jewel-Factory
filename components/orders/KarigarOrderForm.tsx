'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Optional } from '@/components/ui/field-mark';
import { apiPost, apiSend } from '@/hooks/use-api';
import { downloadKarigarOrderPdf, type KarigarPdfOrder } from '@/lib/karigar-pdf';

type Karigar = { id: string; code: string };

export type KarigarOrderFormData = {
  id: string;
  orderNumber: string;
  referenceOrderNumber: string | null;
  storeName: string | null;
  storeAddress: string | null;
  karigarId?: string | null;
  category: string;
  subCategory: string | null;
  weightGramsMin: string | number | null;
  weightGramsMax: string | number | null;
  purity: string | null;
  quantity: string | null;
  deliveryDate: string | null;
  karigarDeliveryDate: string | null;
  meena: string | null;
  length: string | null;
  size: string | null;
  broadness: string | null;
  screw: string | null;
  sampleWeightGrams: string | number | null;
  narration1: string | null;
  narration2: string | null;
  qc: string | null;
  orderType: string | null;
  orderStage: string | null;
  urgent: boolean;
  karigarCode: string | null;
  designNotes: string | null;
  imageUrl: string | null;
};

/**
 * Phase 2 (auto-filled + manually-set fields) + Phase 3 (PDF) for one
 * Karigar-assignment Customised Order. Category/weight/quantity/Karigar/
 * client delivery date/melting come pre-filled from assignment (read-only
 * display, not re-editable here since they mirror the source order); Meena,
 * Length, Broadness, Screw, Narration 1/2, QC, Order Type and Urgent are the
 * manually-filled fields. "Expected Delivery Date" and "Order Stage" are
 * left as free text — their exact meaning/options are still undecided by the
 * client (see CLAUDE.md), so no dropdown is invented here.
 */
export function KarigarOrderForm({ order, onSaved }: { order: KarigarOrderFormData; onSaved: () => void }) {
  const [meena, setMeena] = useState(order.meena ?? '');
  const [length, setLength] = useState(order.length ?? '');
  const [broadness, setBroadness] = useState(order.broadness ?? '');
  const [screw, setScrew] = useState(order.screw ?? '');
  const [narration1, setNarration1] = useState(order.narration1 ?? '');
  const [narration2, setNarration2] = useState(order.narration2 ?? '');
  const [qc, setQc] = useState(order.qc ?? '');
  const [orderType, setOrderType] = useState(order.orderType ?? '');
  const [orderStage, setOrderStage] = useState(order.orderStage ?? '');
  const [urgent, setUrgent] = useState(order.urgent);
  const [karigarId, setKarigarId] = useState(order.karigarId ?? '');
  const [karigars, setKarigars] = useState<Karigar[] | null>(null);
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'customer' | 'karigar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No pre-existing per-product karigarCode to suggest from here (this order
  // may have no linked catalog product at all — the bespoke-request origin),
  // so this is the manual Karigar picker for that path. Shares the same
  // manufacturer-scoped master-list as KarigarAssignPanel — add/remove here
  // is reflected there too, since both just re-fetch /api/manufacturer/karigars.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/manufacturer/karigars', { credentials: 'same-origin', cache: 'no-store' });
      const json = (await res.json()) as { data?: Karigar[] };
      if (!cancelled) setKarigars(json.data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  async function addKarigar() {
    const code = newCode.trim();
    if (!code) return;
    try {
      const created = (await apiPost('/api/manufacturer/karigars', { code })) as Karigar;
      setKarigars((prev) => [...(prev ?? []), created].sort((a, b) => a.code.localeCompare(b.code)));
      setKarigarId(created.id);
      setNewCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add Karigar');
    }
  }

  async function removeKarigar(id: string) {
    try {
      const res = await fetch(`/api/manufacturer/karigars/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to remove Karigar');
      setKarigars((prev) => (prev ?? []).filter((k) => k.id !== id));
      if (karigarId === id) setKarigarId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove Karigar');
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const karigar = karigars?.find((k) => k.id === karigarId) ?? null;
      await apiSend('PATCH', `/api/manufacturer/custom-designs/${order.id}/karigar-form`, {
        meena: meena || null, length: length || null, broadness: broadness || null, screw: screw || null,
        narration1: narration1 || null, narration2: narration2 || null, qc: qc || null,
        orderType: orderType || null, orderStage: orderStage || null, urgent,
        karigarId: karigarId || null, karigarCode: karigar?.code ?? null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toPdfInput(): KarigarPdfOrder {
    return {
      orderNumber: order.orderNumber,
      referenceOrderNumber: order.referenceOrderNumber,
      storeName: order.storeName,
      storeAddress: order.storeAddress,
      category: order.category,
      subCategory: order.subCategory,
      weightGramsMin: order.weightGramsMin,
      weightGramsMax: order.weightGramsMax,
      purity: order.purity,
      quantity: order.quantity,
      deliveryDate: order.deliveryDate,
      karigarDeliveryDate: order.karigarDeliveryDate,
      meena, length, broadness, screw,
      size: order.size,
      sampleWeightGrams: order.sampleWeightGrams,
      narration1, narration2, qc, orderType, orderStage,
      urgent,
      karigarCode: karigars?.find((k) => k.id === karigarId)?.code ?? order.karigarCode,
      designNotes: order.designNotes,
      imageUrl: order.imageUrl,
    };
  }

  async function generatePdf(variant: 'customer' | 'karigar') {
    setPdfBusy(variant);
    try {
      await downloadKarigarOrderPdf(toPdfInput(), variant);
    } finally {
      setPdfBusy(null);
    }
  }

  const field = (label: string, value: string) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field('Category', [order.category, order.subCategory].filter(Boolean).join(' › '))}
        {field('Quantity', order.quantity ?? '')}
        {field('Melting / Purity', order.purity ?? '')}
        {field('Client Delivery Date', order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')}
        {field('Karigar Delivery Date', order.karigarDeliveryDate ? new Date(order.karigarDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Karigar<Optional /></p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={karigarId}
            onChange={(e) => setKarigarId(e.target.value)}
          >
            <option value="">Choose Karigar…</option>
            {(karigars ?? []).map((k) => <option key={k.id} value={k.id}>{k.code}</option>)}
          </select>
          {karigarId && (
            <button type="button" className="text-[11px] text-red-600 underline" onClick={() => void removeKarigar(karigarId)}>
              Remove this code
            </button>
          )}
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="+ Add new Karigar Code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="h-8 w-40 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={!newCode.trim()} onClick={() => void addKarigar()}>Add</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meena<Optional /></span>
          <input value={meena} onChange={(e) => setMeena(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Length<Optional /></span>
          <input value={length} onChange={(e) => setLength(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Broadness<Optional /></span>
          <input value={broadness} onChange={(e) => setBroadness(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Screw<Optional /></span>
          <input value={screw} onChange={(e) => setScrew(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">QC<Optional /></span>
          <input value={qc} onChange={(e) => setQc(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Type<Optional /></span>
          <input value={orderType} onChange={(e) => setOrderType(e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
        <label className="space-y-1 col-span-2 sm:col-span-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Stage<Optional /></span>
          <input value={orderStage} onChange={(e) => setOrderStage(e.target.value)} placeholder="To be decided" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Narration 1<Optional /></span>
        <textarea value={narration1} onChange={(e) => setNarration1(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      </label>
      <label className="space-y-1 block">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Narration 2<Optional /></span>
        <textarea value={narration2} onChange={(e) => setNarration2(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
        <span className="font-medium text-red-600">Urgent</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()} className="metal-sheen text-[#17120b] font-semibold">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
        <Button size="sm" variant="outline" disabled={pdfBusy !== null} onClick={() => void generatePdf('customer')}>
          {pdfBusy === 'customer' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Customer PDF'}
        </Button>
        <Button size="sm" variant="outline" disabled={pdfBusy !== null} onClick={() => void generatePdf('karigar')}>
          {pdfBusy === 'karigar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Karigar PDF'}
        </Button>
      </div>
    </div>
  );
}
