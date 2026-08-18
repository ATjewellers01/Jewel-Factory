import { getServerEnv } from '@/lib/env';

/**
 * Server-to-server client for O2D's Jewel Factory integration (see
 * orderToDispatch_at_jweller_backend/src/routes/integrations.jewel-factory.routes.ts).
 * Shared-secret auth -- no manufacturer login involved, and the secret is
 * never sent to the browser (only called from Hono route handlers).
 *
 * O2D mints orderNo itself, atomically, inside createOrderRecord() -- this
 * client must never invent or send one. That's what guarantees an order
 * created here can never collide with one created through O2D's own UI.
 */

export type O2dCompany = { id: string; name: string };
export type O2dKarigar = { id: string; code: string; name: string };
export type O2dMelting = { id: string; type: string; purity: string };
export type O2dDeliveryLocation = { id: string; name: string };
export type O2dOrderStage = { id: string; name: string };
export type O2dCategory = { id: string; name: string };
export type O2dOrderStatus = { id: string; orderNo: string; currentStage: string };

export type O2dDesignSourceItem = {
  designNumber: string;
  imageUrl?: string | null;
  category?: string | null;
  subCategory?: string | null;
  purity?: string | null;
  weightGrams?: number | string | null;
  description?: string | null;
  pieces?: number | null;
};

export type CreateO2dOrderInput = {
  companyId: string;
  karigarId: string;
  category: string;
  quantityText?: string;
  fromWeight: number;
  toWeight: number;
  totalWeight?: number;
  sampleWeight?: number;
  // Plain string fields on O2D's Order, matching one of its own master-data
  // lists exactly (see listO2dMeltings/listO2dDeliveryLocations/
  // listO2dOrderStages below) -- not foreign keys like companyId/karigarId.
  melting?: string;
  meena?: string;
  length?: string;
  size?: string;
  broadness?: string;
  screw?: string;
  karigarNotes?: string;
  narration1?: string;
  narration2?: string;
  qc?: string;
  orderType?: 'NORMAL' | 'URGENT' | 'STOCK' | 'REPAIR_ITEM';
  orderStage?: string;
  expectedDeliveryDate: string;
  karigarDeliveryDate: string;
  // O2D's own Add Order form sets this to the same date as
  // expectedDeliveryDate -- without it, O2D's own "Delivery Date" table
  // column stays blank.
  dueDate?: string;
  deliveryLocation: string;
  // O2D's "Order No. Reference" field (an existing free-text column,
  // relabeled in O2D's own Edit dialog) -- carries this order's source
  // Jewel Factory order number (JFA-####) so it's visible in O2D's UI
  // without any new O2D-side field or migration.
  description?: string;
  images?: string[];
  designSourceItems?: O2dDesignSourceItem[];
};

export type CreateO2dOrderResult = { id: string; orderNo: string };

function o2dBase(): string | null {
  const url = getServerEnv().O2D_INTEGRATION_BASE_URL;
  return url ? url.replace(/\/$/, '') : null;
}

export function isO2dIntegrationConfigured(): boolean {
  const env = getServerEnv();
  return !!env.O2D_INTEGRATION_BASE_URL && !!env.O2D_INTEGRATION_SECRET;
}

async function o2dFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = o2dBase();
  const secret = getServerEnv().O2D_INTEGRATION_SECRET;
  if (!base || !secret) {
    throw new Error('O2D integration is not configured (O2D_INTEGRATION_BASE_URL / O2D_INTEGRATION_SECRET unset).');
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-integration-secret': secret,
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : 'O2D unreachable';
    throw new Error(`O2D service unreachable — ${detail}`);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON upstream */ }
  if (!res.ok) {
    const j = json as { message?: string } | null;
    throw new Error(j?.message || `O2D upstream ${res.status}: ${text.slice(0, 200)}`);
  }
  return (json as { data: T }).data;
}

export function listO2dCompanies(): Promise<O2dCompany[]> {
  return o2dFetch<O2dCompany[]>('/companies');
}

export function listO2dKarigars(): Promise<O2dKarigar[]> {
  return o2dFetch<O2dKarigar[]>('/karigars');
}

export function listO2dMeltings(): Promise<O2dMelting[]> {
  return o2dFetch<O2dMelting[]>('/meltings');
}

export function listO2dDeliveryLocations(): Promise<O2dDeliveryLocation[]> {
  return o2dFetch<O2dDeliveryLocation[]>('/delivery-locations');
}

export function listO2dOrderStages(): Promise<O2dOrderStage[]> {
  return o2dFetch<O2dOrderStage[]>('/order-stages');
}

export function listO2dCategories(): Promise<O2dCategory[]> {
  return o2dFetch<O2dCategory[]>('/categories');
}

// Read-only production-stage check for an order already sent to O2D (its
// O2D id, i.e. CustomDesignOrder.o2dOrderId) -- used to sync Jewel Factory's
// own item status forward as the piece moves through O2D's pipeline.
export function getO2dOrderStatus(o2dOrderId: string): Promise<O2dOrderStatus> {
  return o2dFetch<O2dOrderStatus>(`/orders/${o2dOrderId}/status`);
}

export function createO2dOrder(input: CreateO2dOrderInput): Promise<CreateO2dOrderResult> {
  return o2dFetch<CreateO2dOrderResult>('/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
