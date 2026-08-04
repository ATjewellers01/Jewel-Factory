/**
 * Client-side order-filter helpers shared by the HO Manager, Manufacturer and
 * Store Manager order-list pages. Keep all filtering logic here so every page
 * behaves the same.
 */

// Status buckets for kiosk guest orders + B2B orders (OrderStatus enum).
// Order-level filter for Kiosk/Catalog(B2B) orders — order-level status is now
// manual (Pending -> Approved -> Completed, see app/manufacturer/orders/page.tsx),
// so IN_PROCESS reads "Approved" here, not "In Process" (that label is still
// used for per-item statuses elsewhere).
export const KIOSK_B2B_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROCESS', label: 'Approved' },
  { value: 'GHAT_RECEIVED', label: 'Ghat Received' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready For Delivery' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Status buckets for custom design REQUESTS (HO side — CustomStatus enum).
export const CUSTOM_REQUEST_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'FORWARDED', label: 'Forwarded' },
  { value: 'REJECTED', label: 'Rejected' },
];

// Status buckets for custom design ORDERS (Manufacturer side — CustomOrderStatus).
export const CUSTOM_ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROCESS', label: 'In Process' },
  { value: 'GHAT_RECEIVED', label: 'Ghat Received' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready For Delivery' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Derived status buckets for the Store Manager "My Orders" (no raw enum shown).
export const SM_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
];

// ── Derived Store-Manager buckets (extraction of logic that used to live inline
// in app/store-manager/my-orders/page.tsx:52-71). Moved here so web and mobile
// share one readable source (decision #7). Behaviour is byte-for-byte identical:
// `completedAt` is tested FIRST in both, so an order the manufacturer has
// finished AND the Store Manager marked delivered-to-customer reads "Completed",
// while one the manufacturer finished but isn't yet marked complete reads
// "Approved" (intended — `completedAt` is a separate flag, not derived from status).
//
// This is purely the Retailer Admin <-> Retailer User approval conversation —
// independent of the manufacturer's own (separate) production status, which is
// shown alongside it, not instead of it, on Kiosk/Restock (per-item) and
// Customised (order-level "Manufacturer Status" block).
type SmOrder = {
  status?: string;
  completedAt?: string | null;
  pendingStoreApproval?: boolean;
  pendingManagerApproval?: boolean;
};

/** Label + badge colour for a kiosk/b2b order in the Store Manager's view. */
export function statusOf(o: SmOrder): { label: string; cls: string } {
  if (o.completedAt) return { label: 'Completed', cls: 'bg-green-100 text-green-800' };
  if (o.status === 'CANCELLED') return { label: 'Rejected', cls: 'bg-red-100 text-red-700' };
  if (o.pendingStoreApproval || o.pendingManagerApproval) return { label: 'Pending (Head Office)', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Approved', cls: 'bg-blue-100 text-blue-800' };
}

/** Derived filter bucket for kiosk/b2b orders (no raw enum shown to the SM). */
export function bucketOf(o: SmOrder): 'COMPLETED' | 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (o.completedAt) return 'COMPLETED';
  if (o.status === 'CANCELLED') return 'REJECTED';
  if (o.pendingStoreApproval || o.pendingManagerApproval) return 'PENDING';
  return 'APPROVED';
}

/** Build a de-duplicated, sorted dropdown option list from a set of names. */
export function uniqueBranchOptions(names: (string | null | undefined)[]): { value: string; label: string }[] {
  const set = new Set<string>();
  for (const n of names) {
    const v = (n ?? '').trim();
    if (v) set.add(v);
  }
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));
}

/** True if `createdAt` falls within the [from, to] date window (inclusive). */
export function inDateRange(createdAt: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!createdAt) return false;
  const day = createdAt.slice(0, 10); // 'YYYY-MM-DD' — compares lexicographically
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/**
 * Generic matcher for a list row.
 * - search: substring match against the order number / label
 * - status: exact match against the row status (skip when '')
 * - branch/retailer: exact match against the row's group name (skip when '')
 * - from/to: inclusive createdAt date window (skip when both '')
 */
export function matchOrder(
  row: { orderNumber?: string | null; status?: string | null; createdAt?: string | null },
  opts: { search: string; status: string; searchLabel?: string; branch?: string; branchName?: string | null; from?: string; to?: string },
): boolean {
  const q = opts.search.trim().toLowerCase();
  if (q) {
    const hay = `${row.orderNumber ?? ''} ${opts.searchLabel ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (opts.status && (row.status ?? '') !== opts.status) return false;
  if (opts.branch && (opts.branchName ?? '') !== opts.branch) return false;
  if (!inDateRange(row.createdAt, opts.from ?? '', opts.to ?? '')) return false;
  return true;
}
