'use client';

import { useMemo, useState } from 'react';

import { AssignKarigarModal, type AssignKarigarManualFields } from '@/components/orders/AssignKarigarModal';
import { KarigarPicker, useKarigarCodes, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { apiPost } from '@/hooks/use-api';
import { formatOrderStatus } from '@/lib/format';
import type { OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';

export type CatalogOrderItem = {
  id: string;
  productNameSnapshot: string;
  productImageSnapshot: string | null;
  categorySnapshot: string | null;
  quantity: number;
  status: string;
  purity: string | null;
  product: OrderItemProduct | null;
  customisedOrderId?: string | null;
};

const STATUS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', IN_PROCESS: 'bg-blue-100 text-blue-800',
  GHAT_RECEIVED: 'bg-purple-100 text-purple-800', READY_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DISPATCHED: 'bg-amber-100 text-amber-800', COMPLETED: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-700',
};
const ALL_ITEM_STATUSES = ['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

/**
 * Karigar assignment state/logic for one Catalog/Kiosk order (2026-08-10
 * redesign) — separated from the items table below so the caller can render
 * the picker (dropdown + "Assign items") on the SAME row as "Ship to",
 * while the item checkboxes stay in the item rows underneath.
 */
export function useCatalogOrderAssignment(orderId: string, source: 'b2b' | 'kiosk', items: CatalogOrderItem[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickedKarigar, setPickedKarigar] = useState<Karigar | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const { filteredCodes, allCodes } = useKarigarCodes(orderId, source, /* filtered */ true);
  const unassigned = useMemo(() => items.filter((i) => !i.customisedOrderId), [items]);
  const endpointBase = source === 'kiosk' ? '/api/manufacturer/kiosk-orders' : '/api/manufacturer/orders';

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePick(karigar: Karigar | null) {
    setPickedKarigar(karigar);
    if (!karigar) { setSelected(new Set()); return; }
    setSelected(new Set(unassigned.filter((i) => i.product?.karigarCode === karigar.code).map((i) => i.id)));
  }

  async function submitAssignment(fields: AssignKarigarManualFields, onAssigned: () => void) {
    setAssigning(true);
    try {
      const created = (await apiPost(`${endpointBase}/${orderId}/assign-karigar`, {
        itemIds: [...selected],
        karigarId: pickedKarigar?.id ?? null,
        karigarCode: pickedKarigar?.code ?? null,
      })) as { id: string };
      await apiPost(`/api/manufacturer/custom-designs/${created.id}/karigar-form`, {
        meena: fields.meena || null, length: fields.length || null, broadness: fields.broadness || null, screw: fields.screw || null,
        narration1: fields.narration1 || null, narration2: fields.narration2 || null, qc: fields.qc || null,
        orderType: fields.orderType || null, orderStage: fields.orderStage || null, urgent: fields.urgent,
      }).catch(() => {}); // best-effort — the order is already created either way
      setSelected(new Set());
      setPickedKarigar(null);
      setModalOpen(false);
      onAssigned();
    } finally {
      setAssigning(false);
    }
  }

  const anchor = unassigned.find((i) => selected.has(i.id))?.product ?? unassigned[0]?.product ?? null;
  const totalQty = [...selected].reduce((sum, id) => sum + (items.find((i) => i.id === id)?.quantity ?? 0), 0);

  return { selected, toggleItem, filteredCodes, allCodes, unassigned, modalOpen, setModalOpen, assigning, pickedKarigar, handlePick, submitAssignment, anchor, totalQty };
}

export type CatalogOrderAssignment = ReturnType<typeof useCatalogOrderAssignment>;

/** The Karigar dropdown + "Assign items" button — render on the SAME row as "Ship to". */
export function CatalogOrderKarigarPicker({ assignment }: { assignment: CatalogOrderAssignment }) {
  if (assignment.unassigned.length === 0 || assignment.filteredCodes === null) return null;
  return (
    <KarigarPicker
      codes={assignment.filteredCodes}
      allCodes={assignment.allCodes ?? undefined}
      selectedCount={assignment.selected.size}
      onPick={assignment.handlePick}
      onAssign={() => assignment.setModalOpen(true)}
      assignDisabled={assignment.assigning}
      assignBusy={assignment.assigning}
    />
  );
}

/** The ITEMS table (table headers, checkbox-per-row, status dropdown) + the Assignment modal. */
export function CatalogOrderItemsBlock({
  assignment,
  items,
  customisedOrderNumberFor,
  itemBusy,
  onItemStatusChange,
  onItemClick,
  onItemImageClick,
  onAssigned,
}: {
  assignment: CatalogOrderAssignment;
  items: CatalogOrderItem[];
  customisedOrderNumberFor: (id: string | null | undefined) => string | null;
  itemBusy: string | null;
  onItemStatusChange: (item: CatalogOrderItem, next: string) => void;
  onItemClick: (item: CatalogOrderItem) => void;
  onItemImageClick: (item: CatalogOrderItem) => void;
  onAssigned: () => void;
}) {
  return (
    <>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Items</p>
        {items.length > 0 && (
          <div className="space-y-1">
            <div className="hidden grid-cols-[1.5rem_5rem_1fr_3rem_7rem] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span />
              <span>Image</span>
              <span>Design No.</span>
              <span>Qty</span>
              <span>Status</span>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex w-full items-center gap-3 rounded-lg hover:bg-black/5">
                  {!it.customisedOrderId ? (
                    <input
                      type="checkbox"
                      checked={assignment.selected.has(it.id)}
                      onChange={(e) => { e.stopPropagation(); assignment.toggleItem(it.id); }}
                      className="ml-1 h-4 w-4 shrink-0"
                    />
                  ) : <span className="ml-1 h-4 w-4 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => it.product && onItemClick(it)}
                    disabled={!it.product}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    {it.productImageSnapshot ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.productImageSnapshot}
                        alt={it.productNameSnapshot}
                        className="h-20 w-20 shrink-0 rounded-lg border bg-white object-contain p-1 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={(e) => { e.stopPropagation(); onItemImageClick(it); }}
                      />
                    ) : <div className="h-20 w-20 shrink-0 rounded-lg border bg-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{it.product?.designNumber ?? it.productNameSnapshot}</span>
                      <span className="block text-xs text-muted-foreground">
                        {it.product?.category ?? it.categorySnapshot ?? '—'}
                        {it.product?.subCategory ? ` › ${it.product.subCategory}` : ''}
                        {it.product?.weightGrams != null ? ` · ${it.product.weightGrams}gm` : ''}
                        {it.purity ? ` · ${it.purity}` : ''}
                      </span>
                      {it.product?.karigarCode && (
                        <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Karigar: {it.product.karigarCode}</span>
                      )}
                      {it.customisedOrderId && (
                        <span className="mt-0.5 ml-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                          Customised Order: {customisedOrderNumberFor(it.customisedOrderId) ?? '…'}
                        </span>
                      )}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">× {it.quantity}</span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[it.status] ?? ''}`}>{formatOrderStatus(it.status)}</span>
                    <select
                      value={it.status}
                      disabled={itemBusy === it.id}
                      onChange={(e) => { e.stopPropagation(); onItemStatusChange(it, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 rounded border border-input bg-transparent px-1 text-[10px] disabled:opacity-50"
                    >
                      {ALL_ITEM_STATUSES.map((s) => <option key={s} value={s}>{formatOrderStatus(s)}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {assignment.modalOpen && (
        <AssignKarigarModal
          title="Assign Karigar"
          submitLabel="Submit"
          autoFill={{
            category: assignment.anchor?.category ?? '',
            subCategory: assignment.anchor?.subCategory ?? null,
            quantity: assignment.totalQty ? String(assignment.totalQty) : null,
            purity: assignment.anchor?.purity ?? null,
            deliveryDate: null,
            karigarDeliveryDate: null,
          }}
          onSubmit={(fields) => assignment.submitAssignment(fields, onAssigned)}
          onClose={() => assignment.setModalOpen(false)}
        />
      )}
    </>
  );
}
