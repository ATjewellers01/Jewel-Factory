'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { AssignKarigarModal, type AssignKarigarManualFields } from '@/components/orders/AssignKarigarModal';
import { Button } from '@/components/ui/button';
import { apiSend } from '@/hooks/use-api';
import { downloadKarigarOrderPdf, type KarigarPdfOrder } from '@/lib/karigar-pdf';

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
  totalWeightGrams?: string | number | null;
  karigarNotes?: string | null;
  narration1: string | null;
  narration2: string | null;
  qc: string | null;
  orderType: string | null;
  orderStage: string | null;
  urgent: boolean;
  karigarCode: string | null;
  designNotes: string | null;
  imageUrl: string | null;
  createdAt?: string | null;
};

export type KarigarOrderFormItem = {
  designNumber: string;
  imageUrl: string | null;
  quantity: number;
  category: string | null;
  subCategory: string | null;
  weightGrams: string | number | null;
  purity: string | null;
};

/**
 * Customised Order card content (2026-08-10 redesign) — an "Edit" button
 * (reopens AssignKarigarModal, PATCHing the manual fields) plus a "PDF"
 * dropdown (Customer PDF / Karigar PDF). The manual-field editing UI itself
 * now lives in AssignKarigarModal, shared with the create-time Assign flow.
 */
export function KarigarOrderForm({ order, items, onSaved }: { order: KarigarOrderFormData; items?: KarigarOrderFormItem[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'customer' | 'karigar' | null>(null);

  async function saveEdit(fields: AssignKarigarManualFields) {
    await apiSend('PATCH', `/api/manufacturer/custom-designs/${order.id}/karigar-form`, {
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
    setEditing(false);
    onSaved();
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
      meena: order.meena ?? '', length: order.length ?? '', broadness: order.broadness ?? '', screw: order.screw ?? '',
      size: order.size,
      sampleWeightGrams: order.sampleWeightGrams,
      narration1: order.narration1 ?? '', narration2: order.narration2 ?? '', qc: order.qc ?? '',
      orderType: order.orderType ?? '', orderStage: order.orderStage ?? '',
      urgent: order.urgent,
      karigarCode: order.karigarCode,
      designNotes: order.designNotes,
      imageUrl: order.imageUrl,
      items: items ?? [],
    };
  }

  async function generatePdf(variant: 'customer' | 'karigar') {
    setPdfMenuOpen(false);
    setPdfBusy(variant);
    try {
      await downloadKarigarOrderPdf(toPdfInput(), variant);
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
      <div className="relative">
        <Button type="button" size="sm" variant="outline" disabled={pdfBusy !== null} onClick={() => setPdfMenuOpen((v) => !v)}>
          {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'PDF ▾'}
        </Button>
        {pdfMenuOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border bg-card shadow-lg">
            <button type="button" onClick={() => void generatePdf('customer')} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Customer PDF</button>
            <button type="button" onClick={() => void generatePdf('karigar')} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50">Karigar PDF</button>
          </div>
        )}
      </div>

      {editing && (
        <AssignKarigarModal
          title={`Edit ${order.orderNumber}`}
          submitLabel="Save"
          autoFill={{
            category: order.category, subCategory: order.subCategory, quantity: order.quantity,
            purity: order.purity, weightGramsMin: order.weightGramsMin, weightGramsMax: order.weightGramsMax,
            size: order.size, sampleWeightGrams: order.sampleWeightGrams,
            deliveryDate: order.deliveryDate, karigarDeliveryDate: order.karigarDeliveryDate,
            orderReceivedDate: order.createdAt ?? null,
          }}
          initialManual={{
            meena: order.meena ?? '', length: order.length ?? '', broadness: order.broadness ?? '', screw: order.screw ?? '',
            karigarNotes: order.karigarNotes ?? '',
            totalWeight: order.totalWeightGrams != null ? String(order.totalWeightGrams) : '',
            qc: order.qc ?? '', orderType: order.orderType ?? '', orderStage: order.orderStage ?? '',
            narration1: order.narration1 ?? '', narration2: order.narration2 ?? '', urgent: order.urgent,
          }}
          items={(items ?? []).map((it, i) => ({
            id: String(i),
            designNumber: it.designNumber,
            imageUrl: it.imageUrl,
            quantity: it.quantity,
            category: it.category,
            subCategory: it.subCategory,
            weightGrams: it.weightGrams,
            purity: it.purity,
          }))}
          onSubmit={saveEdit}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
