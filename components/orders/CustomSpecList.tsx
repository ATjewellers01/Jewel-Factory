'use client';

/**
 * The counter spec of a customised order — order number, delivery date, pieces,
 * meena, length, size, broadness, screw, sample weight.
 *
 * Only fields that were actually filled in are rendered, so an old request (or a
 * quick "just this photo" one) shows nothing rather than a wall of dashes. The
 * same component is used by the Retailer User, the Retailer Admin and the
 * manufacturer, so all three read an identical spec.
 */
export type CustomSpec = {
  orderRef?: string | null;
  deliveryDate?: string | Date | null;
  quantity?: number | null;
  meena?: string | null;
  length?: string | null;
  size?: string | null;
  broadness?: string | null;
  screw?: string | null;
  sampleWeightGrams?: string | number | null;
  subCategory?: string | null;
};

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  // The column is a DATE — read it in UTC so it can't slip a day westward.
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function CustomSpecList({ spec, className = '' }: { spec: CustomSpec; className?: string }) {
  const rows: Array<[string, string]> = [];
  if (spec.orderRef) rows.push(['Order no.', spec.orderRef]);
  if (spec.deliveryDate) rows.push(['Delivery', formatDate(spec.deliveryDate)]);
  if (spec.quantity != null) rows.push(['Quantity', `${spec.quantity} PCS`]);
  if (spec.sampleWeightGrams != null && spec.sampleWeightGrams !== '') rows.push(['Sample weight', `${spec.sampleWeightGrams} g`]);
  if (spec.meena) rows.push(['Meena', spec.meena]);
  if (spec.length) rows.push(['Length', spec.length]);
  if (spec.size) rows.push(['Size', spec.size]);
  if (spec.broadness) rows.push(['Broadness', spec.broadness]);
  if (spec.screw) rows.push(['Screw', spec.screw]);

  if (rows.length === 0) return null;

  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3 ${className}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
          <dd className="truncate font-medium text-foreground" title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
