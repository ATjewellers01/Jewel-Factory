'use client';

import { Loader2, Sparkles, ShoppingBag, Award, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useKioskStore } from '@/components/kiosk/StoreContext';
import { useGuestCart } from '@/hooks/use-guest-cart';

type Product = {
  id: string; designNumber: string; name: string; category: string | null;
  description: string | null; purity: string | null; weightGrams: string | null;
  gemstones: string[]; occasionTags: string[]; hasTryon: boolean;
  images: { secureUrl: string; isPrimary: boolean }[];
};

export default function KioskProductDetailPage() {
  const store = useKioskStore();
  const design = useParams().design as string;
  const router = useRouter();
  const cart = useGuestCart();
  const base = `/${store.slug}`;
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/kiosk/catalog/${design}`, { cache: 'no-store' });
        const json = (await res.json()) as { data?: Product; error?: { message: string } };
        if (!res.ok || !json.data) { setError(json.error?.message ?? 'Not found'); return; }
        setProduct(json.data);
        // Fire a view signal (best-effort).
      } catch { setError('Network error'); }
    })();
  }, [design]);

  if (error) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">{error}</div>;
  if (!product) return <div className="flex items-center gap-2 px-4 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const imgs = product.images.length ? product.images : [];

  function addToCart() {
    cart.add({ productId: product!.id, name: product!.name, imageUrl: imgs[0]?.secureUrl });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`${base}/catalog`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Catalog</Link>
      <div className="grid gap-8 md:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-[#ece5da]">
            {imgs[activeImg] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgs[activeImg].secureUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          {imgs.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {imgs.map((im, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImg ? 'border-primary' : 'border-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.secureUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{product.category ?? 'Jewellery'}</p>
            <h1 className="mt-1 text-3xl font-medium tracking-tight">{product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Design {product.designNumber}</p>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-2">
            <Badge>BIS Hallmarked</Badge>
            <Badge>Certified</Badge>
            {product.hasTryon && <Badge>Virtual Try-On</Badge>}
          </div>

          {/* CTAs — no price */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={addToCart} className="rounded-full metal-sheen text-[#17120b] font-semibold"><ShoppingBag className="mr-1.5 h-4 w-4" />Add to Bag</Button>
            <Button onClick={() => { addToCart(); router.push(`${base}/checkout`); }} variant="outline" className="rounded-full border-primary bg-primary/5">Buy Now</Button>
            {product.hasTryon && (
              <Link href={`${base}/try-on?product=${product.id}`}>
                <Button variant="outline" className="rounded-full"><Sparkles className="mr-1.5 h-4 w-4" />Try On</Button>
              </Link>
            )}
          </div>

          {/* Specs */}
          <div className="overflow-hidden rounded-xl border">
            <Spec label="Metal" value="Gold" />
            {product.purity && <Spec label="Purity" value={product.purity} alt />}
            {product.weightGrams && <Spec label="Weight" value={`${product.weightGrams} g`} />}
            {product.gemstones.length > 0 && <Spec label="Gemstones" value={product.gemstones.join(', ')} alt />}
            <Spec label="Category" value={product.category ?? '—'} />
          </div>

          {product.description && <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>}
        </div>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#15803D]"><Award className="h-3 w-3" />{children}</span>;
}
function Spec({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 text-sm ${alt ? 'bg-muted/40' : 'bg-background'}`}>
      <span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span>
    </div>
  );
}
