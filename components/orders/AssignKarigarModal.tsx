'use client';

import { Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { KarigarSelect, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { Button } from '@/components/ui/button';
import { Optional, Required } from '@/components/ui/field-mark';

/** Auto-filled starting values, sourced differently per origin/caller — all now editable. */
export type AssignKarigarAutoFill = {
  category: string;
  subCategory: string | null;
  quantity: string | null;
  purity: string | null;
  weightGramsMin: string | number | null;
  weightGramsMax: string | number | null;
  size: string | null;
  sampleWeightGrams: string | number | null;
  deliveryDate: string | null; // client delivery date
  karigarDeliveryDate: string | null; // client date minus 3 days
  orderReceivedDate: string | null; // read-only display — the order/request's own createdAt
};

/** One item being assigned — shown read-only below the form, and in the PDF. */
export type AssignKarigarItem = {
  id: string;
  designNumber: string;
  imageUrl: string | null;
  quantity: number;
  category: string | null;
  subCategory: string | null;
  weightGrams: string | number | null;
  purity: string | null;
};

export type AssignKarigarManualFields = {
  category: string;
  quantity: string;
  purity: string;
  weightFrom: string;
  weightTo: string;
  size: string;
  sampleWeight: string;
  totalWeight: string;
  deliveryDate: string; // yyyy-mm-dd
  karigarDeliveryDate: string; // yyyy-mm-dd
  meena: string;
  length: string;
  broadness: string;
  screw: string;
  karigarNotes: string;
  qc: string;
  orderType: string;
  orderStage: string;
  narration1: string;
  narration2: string;
  urgent: boolean;
};

function toDateInput(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function buildInitial(autoFill: AssignKarigarAutoFill, initialManual?: Partial<AssignKarigarManualFields>): AssignKarigarManualFields {
  return {
    category: autoFill.category,
    quantity: autoFill.quantity ?? '',
    purity: autoFill.purity ?? '',
    weightFrom: autoFill.weightGramsMin != null ? String(autoFill.weightGramsMin) : '',
    weightTo: autoFill.weightGramsMax != null ? String(autoFill.weightGramsMax) : '',
    size: autoFill.size ?? '',
    sampleWeight: autoFill.sampleWeightGrams != null ? String(autoFill.sampleWeightGrams) : '',
    totalWeight: '',
    deliveryDate: toDateInput(autoFill.deliveryDate),
    karigarDeliveryDate: toDateInput(autoFill.karigarDeliveryDate),
    meena: '', length: '', broadness: '', screw: '', karigarNotes: '', qc: '', orderType: '', orderStage: '', narration1: '', narration2: '',
    urgent: false,
    ...initialManual,
  };
}

/**
 * Shared Assignment Form modal (2026-08-10 redesign, extended 2026-08-11 to
 * match the reference form) — opens on "Assign items" (create) AND on
 * "Edit" (update an existing Customised Order). Every field the reference
 * form shows is now editable here, including the ones that used to be
 * read-only auto-filled display (Category, Quantity, Melting/Purity,
 * weight range, Size, Sample Weight, both delivery dates) — the manufacturer
 * can correct any of them before submitting. Meena and Order Type are
 * required, matching the reference form's red asterisk; everything else
 * stays optional. Order Received Date is the one truly read-only field
 * (mirrors the source order/request's own createdAt).
 */
export function AssignKarigarModal({
  title,
  autoFill,
  initialManual,
  submitLabel,
  onSubmit,
  onClose,
  karigarLabel,
  karigarCodes,
  karigarId,
  onKarigarChange,
  items,
}: {
  title: string;
  autoFill: AssignKarigarAutoFill;
  initialManual?: Partial<AssignKarigarManualFields>;
  submitLabel: string;
  onSubmit: (fields: AssignKarigarManualFields) => Promise<void>;
  onClose: () => void;
  /**
   * Read-only Karigar display — for a caller (e.g. Edit) where the Karigar
   * was already picked at assignment time and isn't changeable here. Mutually
   * exclusive with karigarCodes/karigarId/onKarigarChange below.
   */
  karigarLabel?: string | null;
  /**
   * An editable Karigar dropdown INSIDE this modal (2026-08-14) — for the
   * create-time Assign flow, which no longer has an outer picker before this
   * modal opens. `codes`/`allCodes` come from the same useKarigarCodes hook
   * the caller already uses elsewhere.
   */
  karigarCodes?: { codes: Karigar[]; allCodes?: Karigar[] };
  karigarId?: string;
  onKarigarChange?: (karigar: Karigar | null) => void;
  /** The specific items being assigned — shown read-only with images below the form. */
  items?: AssignKarigarItem[];
}) {
  const [fields, setFields] = useState<AssignKarigarManualFields>(buildInitial(autoFill, initialManual));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function set<K extends keyof AssignKarigarManualFields>(key: K, value: AssignKarigarManualFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (karigarCodes && !karigarId) {
      setError('Choose a Karigar.');
      return;
    }
    if (!fields.meena.trim() || !fields.orderType.trim()) {
      setError('Meena and Order Type are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  const orderReceivedDate = autoFill.orderReceivedDate
    ? new Date(autoFill.orderReceivedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <h2 className="font-display text-lg font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Received Date</p>
              <p className="text-sm font-medium">{orderReceivedDate}</p>
            </div>
            {karigarLabel !== undefined && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Karigar</p>
                <p className="text-sm font-medium">{karigarLabel || '—'}</p>
              </div>
            )}
            {karigarCodes && onKarigarChange && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Karigar<Required /></p>
                <KarigarSelect
                  codes={karigarCodes.codes}
                  allCodes={karigarCodes.allCodes}
                  karigarId={karigarId ?? ''}
                  onPick={onKarigarChange}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category<Optional /></span>
              <input value={fields.category} onChange={(e) => set('category', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity<Optional /></span>
              <input value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Melting / Purity<Optional /></span>
              <input value={fields.purity} onChange={(e) => set('purity', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From Weight<Optional /></span>
              <input type="number" step="0.001" value={fields.weightFrom} onChange={(e) => set('weightFrom', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To Weight<Optional /></span>
              <input type="number" step="0.001" value={fields.weightTo} onChange={(e) => set('weightTo', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Weight<Optional /></span>
              <input type="number" step="0.001" value={fields.totalWeight} onChange={(e) => set('totalWeight', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sample Weight<Optional /></span>
              <input type="number" step="0.001" value={fields.sampleWeight} onChange={(e) => set('sampleWeight', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Size<Optional /></span>
              <input value={fields.size} onChange={(e) => set('size', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client Delivery Date<Optional /></span>
              <input type="date" value={fields.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Karigar Delivery Date<Optional /></span>
              <input type="date" value={fields.karigarDeliveryDate} onChange={(e) => set('karigarDeliveryDate', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meena<Required /></span>
              <input value={fields.meena} onChange={(e) => set('meena', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Length<Optional /></span>
              <input value={fields.length} onChange={(e) => set('length', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Broadness<Optional /></span>
              <input value={fields.broadness} onChange={(e) => set('broadness', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Screw<Optional /></span>
              <input value={fields.screw} onChange={(e) => set('screw', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">QC<Optional /></span>
              <input value={fields.qc} onChange={(e) => set('qc', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Type<Required /></span>
              <input value={fields.orderType} onChange={(e) => set('orderType', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Stage<Optional /></span>
              <input value={fields.orderStage} onChange={(e) => set('orderStage', e.target.value)} placeholder="To be decided" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Karigar Notes<Optional /></span>
            <textarea value={fields.karigarNotes} onChange={(e) => set('karigarNotes', e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
          </label>
          <label className="space-y-1 block">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Narration 1<Optional /></span>
            <textarea value={fields.narration1} onChange={(e) => set('narration1', e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
          </label>
          <label className="space-y-1 block">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Narration 2<Optional /></span>
            <textarea value={fields.narration2} onChange={(e) => set('narration2', e.target.value)} rows={2} className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.urgent} onChange={(e) => set('urgent', e.target.checked)} />
            <span className="font-medium text-red-600">Urgent</span>
          </label>

          {items && items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Items ({items.length})</p>
              <div className="space-y-2 rounded-md border border-input/50 p-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    {it.imageUrl ? (
                      <div className="relative h-14 w-14 shrink-0 rounded-lg border bg-white p-1">
                        <Image src={it.imageUrl} alt={it.designNumber} fill className="object-contain" />
                      </div>
                    ) : <div className="h-14 w-14 shrink-0 rounded-lg border bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{it.designNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.category ?? '—'}{it.subCategory ? ` › ${it.subCategory}` : ''}
                        {it.weightGrams != null ? ` · ${it.weightGrams}gm` : ''}
                        {it.purity ? ` · ${it.purity}` : ''}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={() => void submit()} className="metal-sheen text-[#17120b] font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
