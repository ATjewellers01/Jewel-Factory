'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProductForm, type ProductFormData } from '@/components/manufacturer/ProductForm';

export default function EditProductPage() {
  const id = useParams().id as string;
  const [initial, setInitial] = useState<ProductFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/manufacturer/products/${id}`, { cache: 'no-store' });
        if (res.status === 401) { window.location.assign('/manufacturer/login'); return; }
        const json = (await res.json()) as {
          data?: {
            id: string; designNumber: string; name: string | null; category: string | null;
            subCategory: string | null; description: string | null; weightGrams: string | null;
            purity: string | null; minOrderQty: number; pieces: number | null; size: string | null; karigarCode: string | null;
            status: string; hasTryon: boolean;
            images: { id: string; secureUrl: string; isPrimary: boolean }[];
            tryonAssets: { assetUrl: string; jewelleryType: string }[];
          };
          error?: { message: string };
        };
        if (!res.ok || !json.data) { setError(json.error?.message ?? 'Not found'); return; }
        const p = json.data;
        setInitial({
          id: p.id,
          designNumber: p.designNumber,
          name: p.name ?? '',
          category: p.category ?? '',
          subCategory: p.subCategory ?? '',
          description: p.description ?? '',
          weightGrams: p.weightGrams != null ? String(p.weightGrams) : '',
          purity: p.purity ?? '',
          minOrderQty: String(p.minOrderQty ?? 1),
          pieces: String(p.pieces ?? 1),
          size: p.size ?? '',
          karigarCode: p.karigarCode ?? '',
          status: (p.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'),
          images: p.images,
          hasTryon: p.hasTryon,
          tryon: p.tryonAssets[0] ? { assetUrl: p.tryonAssets[0].assetUrl, jewelleryType: p.tryonAssets[0].jewelleryType } : null,
        });
      } catch {
        setError('Network error');
      }
    })();
  }, [id]);

  if (error) return <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!initial) return <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  return <ProductForm initial={initial} />;
}
