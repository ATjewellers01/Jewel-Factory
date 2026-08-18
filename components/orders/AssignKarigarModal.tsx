'use client';

import { Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { KarigarSelect, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { ManufacturerOrderItemModal, type OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';
import { Button } from '@/components/ui/button';
import { Optional, Required } from '@/components/ui/field-mark';
import { useApi } from '@/hooks/use-api';

type O2dCompany = { id: string; name: string };
type O2dKarigarOption = { id: string; code: string; name: string };
type O2dMeltingOption = { id: string; type: string; purity: string };
type O2dDeliveryLocationOption = { id: string; name: string };
type O2dOrderStageOption = { id: string; name: string };
type O2dCategoryOption = { id: string; name: string };

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
  description: string | null;
};

/** Adapts the (smaller) AssignKarigarItem shape into ManufacturerOrderItemModal's
 * OrderItemProduct so this modal's item list can reuse that existing image+
 * metadata popup instead of building a new one — fields it doesn't carry
 * (size, karigarCode, pieces, subCategory2, gross/net weight) are nulled out. */
function toOrderItemProduct(item: AssignKarigarItem): OrderItemProduct {
  return {
    designNumber: item.designNumber,
    category: item.category,
    subCategory: item.subCategory,
    subCategory2: null,
    weightGrams: item.weightGrams,
    grossWeightGrams: null,
    netWeightGrams: null,
    pieces: null,
    size: null,
    purity: item.purity,
    description: item.description,
    karigarCode: null,
    images: item.imageUrl ? [{ secureUrl: item.imageUrl, isPrimary: true }] : [],
  };
}

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
  /** O2D order-creation fields (lib/integrations/o2d.ts) — blank/unused when
   * O2D isn't configured; the modal hides their inputs in that case and
   * submitAssignment skips the send-to-o2d call entirely. All four are
   * picked from O2D's own master lists (not typed/free text) so the value
   * sent always matches something that actually exists in O2D. */
  o2dCompanyId: string;
  o2dKarigarId: string;
  /** The picked O2D Karigar's `code` (not just its id) -- when the internal
   * Karigar picker is hidden (o2dEnabled), this is what the caller uses as
   * this codebase's own CustomDesignOrder.karigarCode, so the same one pick
   * still shows up correctly on the Karigar PDF etc. */
  o2dKarigarCode: string;
  deliveryLocation: string;
  o2dMelting: string;
  o2dOrderStage: string;
  /** O2D's own strict OrderType enum (NORMAL/URGENT/STOCK) -- kept separate
   * from the `orderType` free-text field above, which is this codebase's
   * own internal field (also used on the Karigar PDF and elsewhere) and
   * must keep accepting any text a manufacturer types there. */
  o2dOrderType: string;
  /** O2D's own category, picked from O2D's own category master list --
   * kept separate from the `category` field above (this codebase's own
   * design-derived category, e.g. "Bangles"), which may not exist as a
   * value in O2D's list at all. */
  o2dCategory: string;
  /** O2D's own Meena (Yes/No only) -- kept separate from the `meena`
   * free-text field below, which is this codebase's own field used
   * regardless of whether O2D is involved. */
  o2dMeena: string;
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
    o2dCompanyId: '', o2dKarigarId: '', o2dKarigarCode: '', deliveryLocation: '', o2dMelting: '', o2dOrderStage: '', o2dOrderType: '',
    o2dCategory: '', o2dMeena: '',
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
  o2dSyncStatus,
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
  /**
   * Whether this CustomDesignOrder was already sent to O2D (Edit caller
   * only — the create-time Assign flow never has this yet, so it's
   * undefined there). When `orderNo` is set, the O2D fields are replaced
   * with a plain "already sent" note instead of inputs, so resaving other
   * edits can never fire a second, duplicate O2D order. When `error` is
   * set (and `orderNo` isn't), the fields still show but with the last
   * failure surfaced, since Save is how a failed send gets retried here.
   */
  o2dSyncStatus?: { orderNo: string | null; error: string | null };
}) {
  const [fields, setFields] = useState<AssignKarigarManualFields>(buildInitial(autoFill, initialManual));
  const [detailItem, setDetailItem] = useState<AssignKarigarItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O2D order-creation fields — hidden entirely when the integration isn't
  // configured (see lib/integrations/o2d.ts), so this modal keeps working
  // exactly as before in any environment without O2D set up.
  const o2dAlreadySent = !!o2dSyncStatus?.orderNo;
  const o2dStatus = useApi<{ enabled: boolean }>(o2dAlreadySent ? '' : '/api/manufacturer/o2d/status');
  const o2dEnabled = !o2dAlreadySent && (o2dStatus.data?.enabled ?? false);
  const o2dCompanies = useApi<O2dCompany[]>(o2dEnabled ? '/api/manufacturer/o2d/companies' : '');
  const o2dKarigars = useApi<O2dKarigarOption[]>(o2dEnabled ? '/api/manufacturer/o2d/karigars' : '');
  const o2dMeltings = useApi<O2dMeltingOption[]>(o2dEnabled ? '/api/manufacturer/o2d/meltings' : '');
  const o2dDeliveryLocations = useApi<O2dDeliveryLocationOption[]>(o2dEnabled ? '/api/manufacturer/o2d/delivery-locations' : '');
  const o2dOrderStages = useApi<O2dOrderStageOption[]>(o2dEnabled ? '/api/manufacturer/o2d/order-stages' : '');
  const o2dCategories = useApi<O2dCategoryOption[]>(o2dEnabled ? '/api/manufacturer/o2d/categories' : '');
  const o2dLoadError = o2dCompanies.error || o2dKarigars.error || o2dMeltings.error || o2dDeliveryLocations.error || o2dOrderStages.error || o2dCategories.error;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Nice-to-have: pre-select the O2D category when the fetched list has an
  // exact (case-insensitive) name match for the auto-filled `category` --
  // the manufacturer can still change it, this just saves a click for the
  // common case where the two taxonomies happen to agree.
  useEffect(() => {
    if (fields.o2dCategory || !o2dCategories.data || !fields.category) return;
    const match = o2dCategories.data.find((c) => c.name.toLowerCase() === fields.category.toLowerCase());
    if (match) setFields((prev) => ({ ...prev, o2dCategory: match.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o2dCategories.data]);

  function set<K extends keyof AssignKarigarManualFields>(key: K, value: AssignKarigarManualFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (karigarCodes && !o2dEnabled && !karigarId) {
      setError('Choose a Karigar.');
      return;
    }
    if (!fields.meena.trim() || !fields.orderType.trim()) {
      setError('Meena and Order Type are required.');
      return;
    }
    // Matches O2D's own Add New Order form's required fields exactly, so a
    // manufacturer never gets past this modal only to have send-to-o2d fail
    // on the server with a confusing error after the internal assignment
    // already succeeded (this is what happened before this check existed --
    // Client/Karigar Delivery Date were the two that actually broke).
    if (o2dEnabled) {
      const missing: string[] = [];
      if (!fields.category.trim()) missing.push('Category');
      if (!fields.quantity.trim()) missing.push('Quantity');
      if (!fields.weightFrom || Number(fields.weightFrom) <= 0) missing.push('From Weight');
      if (!fields.weightTo || Number(fields.weightTo) <= 0) missing.push('To Weight');
      if (!fields.totalWeight || Number(fields.totalWeight) <= 0) missing.push('Total Weight');
      if (!fields.deliveryDate) missing.push('Client Delivery Date');
      if (!fields.karigarDeliveryDate) missing.push('Karigar Delivery Date');
      if (!fields.o2dCompanyId) missing.push('Company');
      if (!fields.o2dCategory) missing.push('O2D Category');
      if (!fields.o2dKarigarId) missing.push('O2D Karigar');
      if (!fields.o2dMeena) missing.push('O2D Meena');
      if (!fields.o2dMelting) missing.push('Melting');
      if (!fields.deliveryLocation) missing.push('Delivery Location');
      if (!fields.o2dOrderStage) missing.push('O2D Order Stage');
      if (!fields.o2dOrderType) missing.push('O2D Order Type');
      if (missing.length > 0) {
        setError(`Required to send to O2D: ${missing.join(', ')}.`);
        return;
      }
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
            {/* Hidden once O2D sending is in play -- the O2D Karigar picker
                below is the same real artisans under the same names, so
                showing both here was just asking the manufacturer to pick
                the same person twice. That single pick now also supplies
                this modal's own internal karigarCode (see o2dKarigarCode). */}
            {karigarCodes && onKarigarChange && !o2dEnabled && (
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
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category{o2dEnabled ? <Required /> : <Optional />}</span>
              <input value={fields.category} onChange={(e) => set('category', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity{o2dEnabled ? <Required /> : <Optional />}</span>
              <input value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Melting / Purity<Optional /></span>
              <input value={fields.purity} onChange={(e) => set('purity', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From Weight{o2dEnabled ? <Required /> : <Optional />}</span>
              <input type="number" step="0.001" value={fields.weightFrom} onChange={(e) => set('weightFrom', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To Weight{o2dEnabled ? <Required /> : <Optional />}</span>
              <input type="number" step="0.001" value={fields.weightTo} onChange={(e) => set('weightTo', e.target.value)} className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Weight{o2dEnabled ? <Required /> : <Optional />}</span>
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

          {o2dAlreadySent && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-xs font-semibold text-emerald-700">Already sent to O2D as order {o2dSyncStatus?.orderNo}.</p>
            </div>
          )}

          {o2dEnabled && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Send to O2D</p>
              {o2dSyncStatus?.error && (
                <p className="text-xs text-red-600">Previous attempt failed: {o2dSyncStatus.error}. Fill these in and Save to retry.</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Company<Required /></span>
                  <select
                    value={fields.o2dCompanyId}
                    onChange={(e) => set('o2dCompanyId', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dCompanies.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dCompanies.data ?? []).map((co) => (
                      <option key={co.id} value={co.id}>{co.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">O2D Category<Required /></span>
                  <select
                    value={fields.o2dCategory}
                    onChange={(e) => set('o2dCategory', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dCategories.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dCategories.data ?? []).map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">O2D Karigar<Required /></span>
                  <select
                    value={fields.o2dKarigarId}
                    onChange={(e) => {
                      const picked = (o2dKarigars.data ?? []).find((k) => k.id === e.target.value);
                      set('o2dKarigarId', e.target.value);
                      set('o2dKarigarCode', picked?.code ?? '');
                    }}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dKarigars.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dKarigars.data ?? []).map((k) => (
                      <option key={k.id} value={k.id}>{k.code} — {k.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Melting<Required /></span>
                  <select
                    value={fields.o2dMelting}
                    onChange={(e) => set('o2dMelting', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dMeltings.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dMeltings.data ?? []).map((m) => (
                      <option key={m.id} value={m.type}>{m.type}{m.purity ? ` (${m.purity})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery Location<Required /></span>
                  <select
                    value={fields.deliveryLocation}
                    onChange={(e) => set('deliveryLocation', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dDeliveryLocations.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dDeliveryLocations.data ?? []).map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">O2D Order Stage<Required /></span>
                  <select
                    value={fields.o2dOrderStage}
                    onChange={(e) => set('o2dOrderStage', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">{o2dOrderStages.loading ? 'Loading…' : 'Select'}</option>
                    {(o2dOrderStages.data ?? []).map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">O2D Order Type<Required /></span>
                  <select
                    value={fields.o2dOrderType}
                    onChange={(e) => set('o2dOrderType', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STOCK">Stock</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">O2D Meena<Required /></span>
                  <select
                    value={fields.o2dMeena}
                    onChange={(e) => set('o2dMeena', e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </label>
              </div>
              {o2dLoadError && (
                <p className="text-xs text-red-600">Couldn&apos;t load O2D data: {o2dLoadError}</p>
              )}
            </div>
          )}

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
                    <button
                      type="button"
                      onClick={() => setDetailItem(it)}
                      className="relative h-14 w-14 shrink-0 cursor-zoom-in rounded-lg border bg-white p-1 hover:border-amber-400"
                      title="View image & details"
                    >
                      {it.imageUrl ? (
                        <Image src={it.imageUrl} alt={it.designNumber} fill className="object-contain" />
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => setDetailItem(it)} className="text-left text-sm font-medium hover:underline">{it.designNumber}</button>
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

      {detailItem && (
        // stopPropagation here, not inside ManufacturerOrderItemModal itself (a
        // shared component used elsewhere without this nesting problem) --
        // without it, a click on its backdrop bubbles up to this modal's own
        // backdrop onClick={onClose} and closes BOTH modals at once.
        <div onClick={(e) => e.stopPropagation()}>
          <ManufacturerOrderItemModal product={toOrderItemProduct(detailItem)} onClose={() => setDetailItem(null)} />
        </div>
      )}
    </div>
  );
}
