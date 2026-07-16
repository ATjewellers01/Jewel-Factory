'use client';

import { Loader2, Upload, X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadToCloudinary } from '@/lib/upload-client';

const CATEGORIES = ['ring', 'earring', 'necklace', 'bangle', 'bracelet', 'pendant', 'chain', 'nose-pin', 'anklet', 'mangalsutra'];
const PURITIES = ['24K', '22K', '18K', '14K', '916', '750', '585'];
const JEWELLERY_TYPES = ['necklace', 'earring_left', 'earring_right', 'ring_index', 'ring_middle', 'bangle'] as const;

export type ProductFormData = {
  id?: string;
  name: string;
  category: string;
  subCategory: string;
  description: string;
  weightGrams: string;
  purity: string;
  minOrderQty: string;
  status: 'DRAFT' | 'ACTIVE';
  designNumber?: string;
  images?: { id: string; secureUrl: string; isPrimary: boolean }[];
  hasTryon?: boolean;
  tryon?: { assetUrl: string; jewelleryType: string } | null;
};

export function ProductForm({ initial }: { initial?: ProductFormData }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const imageInput = useRef<HTMLInputElement>(null);
  const tryonInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProductFormData>(
    initial ?? {
      name: '', category: '', subCategory: '', description: '',
      weightGrams: '', purity: '', minOrderQty: '1', status: 'DRAFT',
    },
  );
  const [images, setImages] = useState(initial?.images ?? []);
  const [tryon, setTryon] = useState(initial?.tryon ?? null);
  const [tryonType, setTryonType] = useState<string>(initial?.tryon?.jewelleryType ?? 'necklace');
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingTryon, setUploadingTryon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  // Create the product first (needed for image/tryon upload folder), then return its id.
  async function ensureProductId(): Promise<string | null> {
    if (form.id) return form.id;
    const res = await fetch('/api/manufacturer/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });
    const json = (await res.json()) as { data?: { id: string; designNumber: string }; error?: { message: string } };
    if (!res.ok || !json.data) { setError(json.error?.message ?? 'Could not create product'); return null; }
    setForm((p) => ({ ...p, id: json.data!.id, designNumber: json.data!.designNumber }));
    return json.data.id;
  }

  function buildPayload() {
    return {
      name: form.name,
      category: form.category || undefined,
      subCategory: form.subCategory || undefined,
      description: form.description || undefined,
      weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
      purity: form.purity || undefined,
      minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : 1,
      status: form.status,
    };
  }

  async function handleImageUpload(file: File) {
    setError(null);
    if (!form.name.trim()) { setError('Enter a design name before uploading photos.'); return; }
    const id = await ensureProductId();
    if (!id) return;
    setUploadingImage(true);
    try {
      const { secureUrl, publicId } = await uploadToCloudinary(`/api/manufacturer/products/${id}/images/sign`, file);
      const res = await fetch(`/api/manufacturer/products/${id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinaryPublicId: publicId, secureUrl }),
      });
      const json = (await res.json()) as { data?: { id: string; secureUrl: string; isPrimary: boolean } };
      if (json.data) setImages((prev) => [...prev, json.data!]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  }

  async function removeImage(imageId: string) {
    if (!form.id) return;
    await fetch(`/api/manufacturer/products/${form.id}/images/${imageId}`, { method: 'DELETE' });
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  async function handleTryonUpload(file: File) {
    setError(null);
    if (!form.name.trim()) { setError('Enter a design name before uploading a try-on asset.'); return; }
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setError('Try-on asset must be a transparent PNG.');
      return;
    }
    const id = await ensureProductId();
    if (!id) return;
    setUploadingTryon(true);
    try {
      const { secureUrl, publicId } = await uploadToCloudinary(`/api/manufacturer/products/${id}/tryon/sign`, file);
      const res = await fetch(`/api/manufacturer/products/${id}/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinaryPublicId: publicId, assetUrl: secureUrl, jewelleryType: tryonType }),
      });
      if (res.ok) setTryon({ assetUrl: secureUrl, jewelleryType: tryonType });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try-on upload failed');
    } finally {
      setUploadingTryon(false);
    }
  }

  async function removeTryon() {
    if (!form.id) return;
    await fetch(`/api/manufacturer/products/${form.id}/tryon`, { method: 'DELETE' });
    setTryon(null);
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) { setError('Design name is required.'); return; }
    setBusy(true);
    try {
      const id = await ensureProductId();
      if (!id) return;
      // If it already existed, patch the fields.
      if (isEdit || initial?.id) {
        await fetch(`/api/manufacturer/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
      } else {
        // Newly created via ensureProductId with current payload — but if the user
        // edited fields after uploading an image (which created it), patch too.
        await fetch(`/api/manufacturer/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
      }
      router.push('/manufacturer/catalog');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">{isEdit ? 'Edit Design' : 'Add Design'}</h1>
        {form.designNumber && <p className="mt-0.5 text-sm text-muted-foreground">Design number: <span className="font-mono">{form.designNumber}</span></p>}
      </div>

      {/* Fields */}
      <section className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Design Name *</label>
          <Input className="mt-1" placeholder="e.g. Lotus Jhumka Set" value={form.name} onChange={set('name')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.category} onChange={set('category')}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sub-category</label>
            <Input className="mt-1" placeholder="e.g. Chandbali" value={form.subCategory} onChange={set('subCategory')} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Weight (g)</label>
            <Input className="mt-1" type="number" step="0.001" placeholder="12.5" value={form.weightGrams} onChange={set('weightGrams')} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Purity</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.purity} onChange={set('purity')}>
              <option value="">—</option>
              {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Min Order Qty</label>
            <Input className="mt-1" type="number" min="1" value={form.minOrderQty} onChange={set('minOrderQty')} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]" placeholder="Design details, motif, occasion." value={form.description} onChange={set('description')} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm max-w-[200px]" value={form.status} onChange={set('status')}>
            <option value="DRAFT">Draft (hidden from stores)</option>
            <option value="ACTIVE">Active (visible)</option>
          </select>
        </div>
      </section>

      {/* Photos — placed AFTER the details so the design name exists before the
          first upload creates the product (empty name → 400 on create). */}
      <section className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catalog Photos</label>
        {!form.name.trim() && (
          <p className="text-xs text-muted-foreground">Enter a design name above to upload photos.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative h-24 w-24 overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.secureUrl} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeImage(img.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={uploadingImage || !form.name.trim()}
            title={!form.name.trim() ? 'Enter a design name first' : undefined}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:text-muted-foreground"
          >
            {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[10px]">Upload</span>
          </button>
          <input ref={imageInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
        </div>
      </section>

      {/* AR Try-On */}
      <section className="space-y-2 rounded-xl border p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AR Try-On (transparent PNG)</label>
        {!form.name.trim() && !tryon && (
          <p className="text-xs text-muted-foreground">Enter a design name above to upload a try-on asset.</p>
        )}
        {tryon ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tryon.assetUrl} alt="try-on" className="h-20 w-20 rounded-lg border object-contain bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]" />
            <div className="flex-1">
              <p className="text-sm">{tryon.jewelleryType}</p>
              <button type="button" onClick={removeTryon} className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Jewellery type</label>
              <select className="mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={tryonType} onChange={(e) => setTryonType(e.target.value)}>
                {JEWELLERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={uploadingTryon || !form.name.trim()} title={!form.name.trim() ? 'Enter a design name first' : undefined} onClick={() => tryonInput.current?.click()}>
              {uploadingTryon ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              Upload PNG
            </Button>
            <input ref={tryonInput} type="file" accept="image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && handleTryonUpload(e.target.files[0])} />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/manufacturer/catalog')}>Cancel</Button>
      </div>
    </div>
  );
}
