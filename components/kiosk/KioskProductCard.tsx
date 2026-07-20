'use client';

import { Camera, Check, Gem, Plus } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useState } from 'react';

import { titleCaseName, productMetaLine } from '@/lib/format';

export type KioskCardProduct = {
  id: string;
  designNumber: string;
  name: string;
  category: string | null;
  subCategory: string | null;
  purity: string | null;
  weightGrams: string | null;
  hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

const primaryUrl = (p: KioskCardProduct) =>
  (p.images.find((i) => i.isPrimary) ?? p.images[0])?.secureUrl;

/**
 * Shared kiosk product card — LuxeMatch storefront LOOK (hover lift + image zoom,
 * bottom gradient, hover-reveal action bar, AR badge) with the Jewel-Factory
 * kiosk FLOW: the primary action is "Add to order" (no price, no save/compare).
 *
 * - Clicking the image/name calls `onOpen` (the detail modal) when provided.
 * - The hover bar shows "Add to order" (calls `onAdd`) and, for AR pieces, a
 *   Try-On link. `inCart` flips the Add button to an "Added" state.
 */
export function KioskProductCard({
  product,
  index = 0,
  inCart = false,
  onAdd,
  onOpen,
  tryOnBack = '/store-manager/kiosk',
}: {
  product: KioskCardProduct;
  index?: number;
  inCart?: boolean;
  onAdd?: (p: KioskCardProduct) => void;
  onOpen?: (p: KioskCardProduct) => void;
  tryOnBack?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const img = primaryUrl(product);

  const openDetail = () => onOpen?.(product);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className="group relative"
    >
      {/* Image */}
      <button
        type="button"
        onClick={openDetail}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative block w-full cursor-pointer overflow-hidden rounded-lg bg-[#ece5da] shadow-[0_1px_0_rgba(25,21,17,0.08)] ring-1 ring-black/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]"
        style={{ aspectRatio: '3 / 4' }}
        title="View details"
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40"><Gem className="h-8 w-8" /></div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/52 via-black/12 to-transparent opacity-80" />
        <div className={`absolute inset-0 bg-[#1a1208]/15 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`} />

        {/* AR badge (only badge the kiosk data supports) */}
        {product.hasTryon && (
          <span className="metal-sheen absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#1a1208] shadow-sm">
            AR
          </span>
        )}

        {/* Hover action bar — Add to order + (AR) Try On. No save/compare/price. */}
        <div className={`absolute inset-x-3 bottom-3 flex gap-2 transition-all duration-300 ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          {onAdd && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onAdd(product); }}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold shadow-sm transition-transform hover:scale-[1.01] ${inCart ? 'bg-[#f7fff8]/95 text-[#15803D] ring-1 ring-[#15803D]/30' : 'metal-sheen text-[#1a1208]'}`}
              aria-label={inCart ? 'Added to order' : 'Add to order'}
            >
              <span className="flex items-center justify-center gap-1.5">
                {inCart ? <><Check className="h-3.5 w-3.5" />Added</> : <><Plus className="h-3.5 w-3.5" />Add</>}
              </span>
            </span>
          )}
          {product.hasTryon && (
            <Link
              href={`/store-manager/try-on?product=${product.id}&back=${encodeURIComponent(tryOnBack)}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center rounded-lg bg-black/[0.72] p-2 backdrop-blur-sm transition-colors hover:bg-black/[0.85]"
              aria-label="Try on"
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </Link>
          )}
        </div>
      </button>

      {/* Info */}
      <div className="mt-3 space-y-1">
        <button type="button" onClick={openDetail} className="block w-full text-left">
          <p className="line-clamp-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {titleCaseName(product.name)}
          </p>
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {productMetaLine({ category: product.category, subCategory: product.subCategory, purity: product.purity, weight: product.weightGrams })}
        </p>
      </div>
    </motion.div>
  );
}
