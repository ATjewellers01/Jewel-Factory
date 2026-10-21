// Weights are entered and stored to at most 3 decimal places (e.g. 10.856 gm).
// Inputs reject a keystroke that would add a 4th decimal, pad to 3 decimals
// on blur, and the API rounds again server-side.

/** True when a weight input's raw text is acceptable: digits with at most 3 decimals (or empty). */
export function isWeightInput(value: string): boolean {
  return /^\d*\.?\d{0,3}$/.test(value);
}

/** Formats a weight input to exactly 3 decimal places on blur (e.g. "20.350"). */
export function formatWeight3(value: string): string {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) ? n.toFixed(3) : value;
}

/** Server-side: round a weight to 3 decimal places. */
export function roundWeight3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
