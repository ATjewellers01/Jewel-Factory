'use client';

import { Sparkles, Check, Plus, Award } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useKioskStore } from './StoreContext';
import { useGuestCart } from '@/hooks/use-guest-cart';
import { productMetaParts } from '@/lib/format';

export type KioskProduct = {
  id: string;
  designNumber: string;
  name?: string | null;
  category: string | null;
  subCategory: string | null;
  purity: string | null;
  weightGrams: string | null;
  hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

export function ProductCard({ product }: { product: KioskProduct }) {
  const store = useKioskStore();
  const cart = useGuestCart();
  const [added, setAdded] = useState(false);
  const base = `/${store.slug}`;
  const img = product.images.find((i) => i.isPrimary) ?? product.images[0];

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    cart.add({ productId: product.id, name: product.designNumber, imageUrl: img?.secureUrl });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Link href={`${base}/catalog/${product.designNumber}`}>
      <div className="group overflow-hidden rounded-lg bg-[#FBF9F5] ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(31,24,15,0.16)]">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#ece5da]">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.secureUrl} alt={product.designNumber} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : <div className="h-full w-full" />}
          {product.hasTryon && (
            <span className="metal-sheen absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-[#17120b]">
              <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />AR
            </span>
          )}
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-[#f7fff8]/90 px-1.5 py-0.5 text-[9px] font-semibold text-[#15803D]">
            <Award className="h-2.5 w-2.5" />BIS
          </span>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-semibold group-hover:text-primary">{product.designNumber}</p>
          {/* Weight on its own non-truncating line — see productMetaParts. */}
          {(() => {
            const meta = productMetaParts({ category: product.category ?? 'Jewellery', subCategory: product.subCategory, purity: product.purity, weight: product.weightGrams });
            return (
              <>
                <p className="truncate text-xs text-muted-foreground">{meta.descriptor}</p>
                {meta.weight && <p className="text-xs font-medium text-muted-foreground">{meta.weight}</p>}
              </>
            );
          })()}
          <button onClick={addToCart} className="metal-sheen mt-2 w-full rounded-full py-1.5 text-xs font-semibold text-[#17120b] transition-transform hover:scale-[1.02]">
            {added ? <><Check className="mr-1 inline h-3.5 w-3.5" />Added</> : <><Plus className="mr-1 inline h-3.5 w-3.5" />Add to Bag</>}
          </button>
        </div>
      </div>
    </Link>
  );
}
