'use client';

import { Minus, Plus } from 'lucide-react';

/**
 * Add-to-order control that turns into a −/qty/+ stepper once the design is in
 * the cart. Before this, a card in the cart showed a dead "In cart" badge with
 * no way back out — the only way to drop a design was to open the cart panel.
 *
 * Decrementing from 1 removes the line (the quantity never sits at 0), matching
 * how the cart panel's own stepper behaves.
 */
export function CartQtyControl({
  quantity,
  onAdd,
  onSetQuantity,
  addLabel = 'Add',
  className = '',
  size = 'default',
  designNumber,
}: {
  quantity: number;
  onAdd: () => void;
  /** Called with the new quantity; 0 means "remove from the order". */
  onSetQuantity: (quantity: number) => void;
  addLabel?: string;
  className?: string;
  size?: 'default' | 'sm';
  /** Used for screen-reader labels, e.g. "Add one more JF-0060". */
  designNumber?: string;
}) {
  const of = designNumber ? ` ${designNumber}` : '';
  const height = size === 'sm' ? 'h-9' : 'h-10';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  if (quantity <= 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className={`metal-sheen flex ${height} w-full items-center justify-center gap-1.5 rounded-lg ${text} font-semibold text-[#17120b] transition-transform hover:-translate-y-px ${className}`}
      >
        <Plus className={icon} /> {addLabel}
      </button>
    );
  }

  return (
    <div
      className={`flex ${height} w-full items-center justify-between rounded-lg border border-[#c99d37]/45 bg-[#fbf6ea] px-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSetQuantity(quantity - 1)}
        aria-label={quantity === 1 ? `Remove${of} from the order` : `One less${of}`}
        className="flex h-full w-9 items-center justify-center rounded-md text-[#8a6a22] transition-colors hover:bg-[#f1e6cd]"
      >
        <Minus className={icon} />
      </button>
      <span className={`${text} font-semibold tabular-nums text-[#3d3529]`} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onSetQuantity(quantity + 1)}
        aria-label={`One more${of}`}
        className="flex h-full w-9 items-center justify-center rounded-md text-[#8a6a22] transition-colors hover:bg-[#f1e6cd]"
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
