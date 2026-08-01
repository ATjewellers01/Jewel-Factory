import type { SVGProps } from 'react';

/**
 * Jewellery storefront — awning, display window with a necklace, door.
 *
 * Drawn on lucide's grid (24×24, 1.8px stroke, round caps/joins) so it sits
 * beside the lucide icons in the portal chrome without looking pasted in, and
 * strokes in `currentColor` so it turns white on the active gold nav pill.
 *
 * Deliberately lighter on detail than `public/jewelry-store-svgrepo-com.svg`:
 * nav icons render at 18px, where awning stripes and window frames collapse
 * into a smudge. Use the detailed file at large sizes instead.
 */
export function JewelleryStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* awning */}
      <path d="M3.2 9.2 5.2 4.8h13.6l2 4.4" />
      <path d="M3.2 9.2h17.6" />
      {/* shop body + ground line */}
      <path d="M4.8 9.2V20h14.4V9.2" />
      <path d="M2.6 20h18.8" />
      {/* door */}
      <path d="M14 20v-6h4v6" />
      {/* necklace on display */}
      <path d="M7.2 12.4v1.1a2.3 2.3 0 0 0 4.6 0v-1.1" />
      <circle cx="9.5" cy="16.6" r="1" />
    </svg>
  );
}
