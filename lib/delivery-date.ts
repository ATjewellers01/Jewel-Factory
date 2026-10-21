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

/** Today in India (the business is IST-only) — the server runs in UTC, so it can't use its own clock's date. */
export function indiaTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** True when `iso` (YYYY-MM-DD, or a full ISO timestamp) is before `today`. Today itself is allowed. */
export function isPastDeliveryDate(iso: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) && iso.slice(0, 10) < today;
}
