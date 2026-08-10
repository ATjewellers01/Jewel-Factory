'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Optional } from '@/components/ui/field-mark';

/** Auto-filled (read-only) display fields, sourced differently per origin/caller. */
export type AssignKarigarAutoFill = {
  category: string;
  subCategory: string | null;
  quantity: string | null;
  purity: string | null;
  deliveryDate: string | null; // client delivery date
  karigarDeliveryDate: string | null; // client date minus 3 days (assign-time only; null while picking a Karigar pre-assign)
};

export type AssignKarigarManualFields = {
  meena: string;
  length: string;
  broadness: string;
  screw: string;
  qc: string;
  orderType: string;
  orderStage: string;
  narration1: string;
  narration2: string;
  urgent: boolean;
};

const EMPTY_MANUAL: AssignKarigarManualFields = {
  meena: '', length: '', broadness: '', screw: '', qc: '', orderType: '', orderStage: '', narration1: '', narration2: '', urgent: false,
};

/**
 * Shared Assignment Form modal (2026-08-10 redesign) — opens on "Assign
 * items" (create) AND on "Edit" (update an existing Customised Order).
 * Auto-filled fields are read-only display; the rest are manually entered.
 * Submitting calls `onSubmit` with the manual fields — the caller decides
 * whether that means creating a new CustomDesignOrder or PATCHing an
 * existing one.
 */
export function AssignKarigarModal({
  title,
  autoFill,
  initialManual,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  autoFill: AssignKarigarAutoFill;
  initialManual?: Partial<AssignKarigarManualFields>;
  submitLabel: string;
  onSubmit: (fields: AssignKarigarManualFields) => Promise<void>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<AssignKarigarManualFields>({ ...EMPTY_MANUAL, ...initialManual });
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

  const display = (label: string, value: string) => (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );

  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-black/50 p-4 py-8" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-xl rounded-2xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-lg font-medium">{title}</h2>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {display('Category', [autoFill.category, autoFill.subCategory].filter(Boolean).join(' › '))}
            {display('Quantity', autoFill.quantity ?? '')}
            {display('Melting / Purity', autoFill.purity ?? '')}
            {display('Client Delivery Date', fmtDate(autoFill.deliveryDate))}
            {display('Karigar Delivery Date', fmtDate(autoFill.karigarDeliveryDate))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meena<Optional /></span>
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
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Type<Optional /></span>
              <input value={fields.orderType} onChange={(e) => set('orderType', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Stage<Optional /></span>
              <input value={fields.orderStage} onChange={(e) => set('orderStage', e.target.value)} placeholder="To be decided" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
          </div>

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

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void submit()} className="metal-sheen text-[#17120b] font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
