'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { AssignKarigarModal, type AssignKarigarManualFields } from '@/components/orders/AssignKarigarModal';
import { useKarigarCodes, type Karigar } from '@/components/orders/KarigarAssignPanel';
import { apiPost, apiSend } from '@/hooks/use-api';
import type { OrderItemProduct } from '@/components/orders/ManufacturerOrderItemModal';

/**
 * Resolves customisedOrderId -> JFC-#### order number for the "Customised
 * Order: JFC-####" badge on an assigned item (2026-08-11) — the Customised
 * Orders list itself no longer merges into this page, so this fetches each
 * one lazily and caches it (a module-level cache since the same order can
 * be assigned to from multiple item rows/orders in one session).
 */
const orderNumberCache = new Map<string, string>();

export function useCustomisedOrderNumbers(customisedOrderIds: string[]) {
  const [, forceRender] = useState(0);
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toFetch = customisedOrderIds.filter((id) => !orderNumberCache.has(id) && !fetchingRef.current.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach((id) => fetchingRef.current.add(id));
    (async () => {
      await Promise.all(toFetch.map(async (id) => {
        try {
          const res = await fetch(`/api/manufacturer/custom-designs/${id}`, { credentials: 'same-origin', cache: 'no-store' });
          const json = (await res.json()) as { data?: { orderNumber?: string } };
          if (json.data?.orderNumber) orderNumberCache.set(id, json.data.orderNumber);
        } catch {
          // best-effort — badge falls back to "Assigned" if this fails
        } finally {
          fetchingRef.current.delete(id);
        }
      }));
      forceRender((n) => n + 1);
    })();
  }, [customisedOrderIds]);

  return (id: string | null | undefined) => (id ? orderNumberCache.get(id) ?? null : null);
}

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

export const ALL_ITEM_STATUSES = ['PENDING', 'IN_PROCESS', 'GHAT_RECEIVED', 'READY_FOR_DELIVERY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

/**
 * Karigar assignment state/logic for one Catalog/Kiosk order (2026-08-10
 * redesign) — separated from the items table below so the caller can render
 * the picker (dropdown + "Assign items") on the SAME row as "Ship to",
 * while the item checkboxes stay in the item rows underneath.
 */
export function useCatalogOrderAssignment(orderId: string, source: 'b2b' | 'kiosk', items: CatalogOrderItem[], orderDeliveryDate: string | null) {
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

  // Picking a Karigar inside the Assign modal only records the choice — it
  // does NOT touch `selected`. Item selection happens beforehand via the
  // checkboxes in OrderSummaryModal's table (2026-08-14 redesign); auto-
  // matching items to whichever Karigar gets picked would otherwise silently
  // overwrite whatever the manufacturer had manually checked off.
  function handlePick(karigar: Karigar | null) {
    setPickedKarigar(karigar);
  }

  async function submitAssignment(fields: AssignKarigarManualFields, onAssigned: () => void) {
    setAssigning(true);
    try {
      const created = (await apiPost(`${endpointBase}/${orderId}/assign-karigar`, {
        itemIds: [...selected],
        karigarId: pickedKarigar?.id ?? null,
        karigarCode: pickedKarigar?.code ?? null,
      })) as { id: string };
      // NOT best-effort — if this fails, the manufacturer's manually-entered
      // fields (Meena, Screw, Narration, etc.) are silently lost even though
      // the order itself was created. Surface the error instead (2026-08-11
      // fix — a silent .catch(() => {}) here previously masked real PATCH
      // failures, so the order existed but every manual field stayed null).
      await apiSend('PATCH', `/api/manufacturer/custom-designs/${created.id}/karigar-form`, {
        category: fields.category || undefined,
        quantity: fields.quantity || null,
        purity: fields.purity || null,
        weightGramsMin: fields.weightFrom ? Number(fields.weightFrom) : null,
        weightGramsMax: fields.weightTo ? Number(fields.weightTo) : null,
        size: fields.size || null,
        sampleWeightGrams: fields.sampleWeight ? Number(fields.sampleWeight) : null,
        totalWeightGrams: fields.totalWeight ? Number(fields.totalWeight) : null,
        deliveryDate: fields.deliveryDate || null,
        karigarDeliveryDate: fields.karigarDeliveryDate || null,
        meena: fields.meena || null, length: fields.length || null, broadness: fields.broadness || null, screw: fields.screw || null,
        karigarNotes: fields.karigarNotes || null,
        narration1: fields.narration1 || null, narration2: fields.narration2 || null, qc: fields.qc || null,
        orderType: fields.orderType || null, orderStage: fields.orderStage || null, urgent: fields.urgent,
      });
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
  const selectedItems = unassigned.filter((i) => selected.has(i.id));

  // Karigar delivery date = client delivery date minus 3 days (matches the
  // server-side calculation in lib/db/karigar.ts) — computed here too so the
  // modal shows a real date at ASSIGN time, not just after creation.
  const karigarDeliveryDate = orderDeliveryDate
    ? (() => { const d = new Date(orderDeliveryDate); d.setDate(d.getDate() - 3); return d.toISOString(); })()
    : null;

  return {
    selected, toggleItem, filteredCodes, allCodes, unassigned, modalOpen, setModalOpen, assigning,
    pickedKarigar, handlePick, submitAssignment, anchor, totalQty, selectedItems,
    orderDeliveryDate, karigarDeliveryDate,
  };
}

export type CatalogOrderAssignment = ReturnType<typeof useCatalogOrderAssignment>;

/**
 * The Assign-Karigar modal trigger — the item table itself (checkbox,
 * status dropdown, Customised Order No., image/design-code links) now
 * renders directly inside OrderSummaryModal's own table (2026-08-14), so
 * this component only owns the modal that opens once "Assign items" is
 * clicked.
 */
export function CatalogOrderAssignModal({
  assignment,
  onAssigned,
}: {
  assignment: CatalogOrderAssignment;
  onAssigned: () => void;
}) {
  if (!assignment.modalOpen) return null;
  return (
    <AssignKarigarModal
      title="Assign Karigar"
      submitLabel="Submit"
      autoFill={{
        category: assignment.anchor?.category ?? '',
        subCategory: assignment.anchor?.subCategory ?? null,
        quantity: assignment.totalQty ? String(assignment.totalQty) : null,
        purity: assignment.anchor?.purity ?? null,
        weightGramsMin: assignment.anchor?.weightGrams ?? null,
        weightGramsMax: assignment.anchor?.weightGrams ?? null,
        size: null,
        sampleWeightGrams: null,
        deliveryDate: assignment.orderDeliveryDate,
        karigarDeliveryDate: assignment.karigarDeliveryDate,
        // "Order Received Date" here means the day the Karigar is being
        // assigned (today), NOT the source order's own placement date —
        // confirmed with the client (2026-08-11).
        orderReceivedDate: new Date().toISOString(),
      }}
      karigarCodes={{ codes: assignment.filteredCodes ?? [], allCodes: assignment.allCodes ?? undefined }}
      karigarId={assignment.pickedKarigar?.id ?? ''}
      onKarigarChange={assignment.handlePick}
      items={assignment.selectedItems.map((it) => ({
        id: it.id,
        designNumber: it.product?.designNumber ?? it.productNameSnapshot,
        imageUrl: it.productImageSnapshot,
        quantity: it.quantity,
        category: it.product?.category ?? it.categorySnapshot,
        subCategory: it.product?.subCategory ?? null,
        weightGrams: it.product?.weightGrams ?? null,
        purity: it.purity,
      }))}
      onSubmit={(fields) => assignment.submitAssignment(fields, onAssigned)}
      onClose={() => assignment.setModalOpen(false)}
    />
  );
}
