// Delivery dates are plain calendar days (YYYY-MM-DD), compared as strings.
// iPhone Safari ignores the date input's `min`, so a past date can be picked
// there — every form checks with this before submitting, and the API checks
// again server-side.

export const PAST_DELIVERY_DATE_MESSAGE = "Delivery date can't be in the past.";

/** Today in the browser's own timezone, for the date input's `min` and the client-side check. */
export function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** How far ahead a delivery date may be — caps the native picker's year so a
 *  typo like "20026" can't be entered. The browser's `max` and the checks below
 *  both use this. */
export const MAX_DELIVERY_YEARS_AHEAD = 2;
export const FAR_DELIVERY_DATE_MESSAGE = `Delivery date can't be more than ${MAX_DELIVERY_YEARS_AHEAD} years ahead.`;
export const INVALID_DELIVERY_DATE_MESSAGE = 'Enter a valid delivery date.';

/** The latest allowed delivery date (today + MAX_DELIVERY_YEARS_AHEAD), in the browser's timezone. */
export function maxDeliveryDateIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + MAX_DELIVERY_YEARS_AHEAD);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * One message (or null) for a delivery date against a today/max window — a
 * malformed value (e.g. a 5-digit year the native box lets through), a past
 * date, or one beyond the max. Empty is allowed here (callers enforce
 * "required" separately). Used for the live inline error and to gate submit.
 */
export function deliveryDateError(iso: string, today: string, max: string): string | null {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return INVALID_DELIVERY_DATE_MESSAGE;
  if (iso < today) return PAST_DELIVERY_DATE_MESSAGE;
  if (iso > max) return FAR_DELIVERY_DATE_MESSAGE;
  return null;
}

/** Client-side convenience: the error for a delivery date using the browser's today + max. */
export function clientDeliveryDateError(iso: string): string | null {
  return deliveryDateError(iso, localTodayIso(), maxDeliveryDateIso());
}

/** Today in India (the business is IST-only) — the server runs in UTC, so it can't use its own clock's date. */
export function indiaTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** The latest allowed delivery date in India time — the server-side counterpart to maxDeliveryDateIso(). */
export function indiaMaxDeliveryDateIso(): string {
  const [y, m, d] = indiaTodayIso().split('-');
  return `${Number(y) + MAX_DELIVERY_YEARS_AHEAD}-${m}-${d}`;
}

/** True when `iso` (YYYY-MM-DD, or a full ISO timestamp) is before `today`. Today itself is allowed. */
export function isPastDeliveryDate(iso: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) && iso.slice(0, 10) < today;
}
