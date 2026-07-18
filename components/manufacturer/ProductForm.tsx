'use client';

import { Loader2, Upload, X, Trash2, Sparkles, RefreshCw, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadToCloudinary } from '@/lib/upload-client';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';

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
      weightGrams: '', purity: '', minOrderQty: '1', status: 'ACTIVE', // new designs are visible by default
    },
  );
  const [images, setImages] = useState(initial?.images ?? []);
  const [tryon, setTryon] = useState(initial?.tryon ?? null);
  const [tryonType, setTryonType] = useState<string>(initial?.tryon?.jewelleryType ?? 'necklace');
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingTryon, setUploadingTryon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ src: string; checker?: boolean } | null>(null); // click-to-enlarge preview

  // ── AI generate (raw image -> name/description + catalog + transparent) ──────
  const aiInput = useRef<HTMLInputElement>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiRaw, setAiRaw] = useState<File | null>(null);      // temp raw image (not saved)
  const [aiRawPreview, setAiRawPreview] = useState<string | null>(null);
  const [aiInstr, setAiInstr] = useState('');                 // regenerate custom instruction
  const [aiBusy, setAiBusy] = useState<string | null>(null);  // 'all' | 'describe' | 'catalog' | 'transparent'
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manufacturer/ai/status', { cache: 'no-store', credentials: 'same-origin' });
        const json = (await res.json()) as { data?: { enabled: boolean } };
        setAiEnabled(!!json.data?.enabled);
      } catch { setAiEnabled(false); }
    })();
  }, []);

  function pickRaw(file: File) {
    setAiError(null);
    setAiRaw(file);
    setAiRawPreview(URL.createObjectURL(file));
  }

  function aiForm(extra?: boolean): FormData {
    const fd = new FormData();
    fd.append('image', aiRaw!, aiRaw!.name || 'raw.jpg');
    if (extra && aiInstr.trim()) fd.append('extraInstructions', aiInstr.trim());
    return fd;
  }

  async function b64ToFile(b64: string, name: string): Promise<File> {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new File([bytes], name, { type: 'image/png' });
  }

  // Describe: fill name + description (editable). Returns the new name (so the
  // "generate all" flow can pass it to catalog/transparent without waiting for
  // React state to update).
  async function aiDescribe(withInstr = false): Promise<string | null> {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return null; }
    setAiBusy('describe'); setAiError(null);
    try {
      const fd = aiForm(withInstr);
      fd.append('category', form.category); fd.append('subCategory', form.subCategory);
      fd.append('weight', form.weightGrams); fd.append('purity', form.purity);
      const res = await fetch('/api/manufacturer/ai/describe', { method: 'POST', credentials: 'same-origin', body: fd });
      const json = (await res.json()) as { data?: { designName: string; description: string }; error?: { message: string } };
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? 'Describe failed');
      setForm((p) => ({ ...p, name: json.data!.designName || p.name, description: json.data!.description || p.description }));
      return json.data.designName || null;
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Describe failed'); return null; } finally { setAiBusy(null); }
  }

  // Catalog: generate an attractive image and add it as a product photo.
  async function aiCatalog(withInstr = false) {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return; }
    if (!form.name.trim()) { setAiError('Generate/enter a design name first (photos attach to the product).'); return; }
    setAiBusy('catalog'); setAiError(null);
    try {
      const res = await fetch('/api/manufacturer/ai/catalog', { method: 'POST', credentials: 'same-origin', body: aiForm(withInstr) });
      const json = (await res.json()) as { data?: { imageBase64: string }; error?: { message: string } };
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? 'Catalog generation failed');
      const file = await b64ToFile(json.data.imageBase64, 'ai-catalog.png');
      await handleImageUpload(file);
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Catalog generation failed'); } finally { setAiBusy(null); }
  }

  // Transparent: generate a background-free PNG and set it as the try-on asset.
  async function aiTransparent(withInstr = false) {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return; }
    if (!form.name.trim()) { setAiError('Generate/enter a design name first.'); return; }
    setAiBusy('transparent'); setAiError(null);
    try {
      const fd = aiForm(withInstr);
      fd.append('jewelleryType', tryonType);
      const res = await fetch('/api/manufacturer/ai/transparent', { method: 'POST', credentials: 'same-origin', body: fd });
      const json = (await res.json()) as { data?: { imageBase64: string }; error?: { message: string } };
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? 'Transparent generation failed');
      const file = await b64ToFile(json.data.imageBase64, 'ai-tryon.png');
      await handleTryonUpload(file);
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Transparent generation failed'); } finally { setAiBusy(null); }
  }

  // Generate everything at once (name/desc, then catalog + transparent).
  // aiDescribe returns the name so we can set it synchronously before the image
  // steps run (React state hasn't flushed yet in the same tick).
  async function aiGenerateAll() {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return; }
    setAiBusy('all'); setAiError(null);
    const newName = await aiDescribe(false);
    if (newName && !form.name.trim()) {
      // Ensure the name is committed before the image steps' name-gate.
      setForm((p) => ({ ...p, name: p.name.trim() || newName }));
      await new Promise((r) => setTimeout(r, 0)); // let the state flush
    }
    await aiCatalog(false);
    await aiTransparent(false);
    setAiBusy(null);
  }

  const set = (k: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  // Sub-categories depend on the chosen category. Changing category resets sub-cat.
  const subOptions = subCategoriesFor(form.category);
  // "Custom" sub-category mode: no preset list, or an existing value that isn't in
  // the list (e.g. free text the user typed, or a legacy value). Then show a text box.
  const [subCustom, setSubCustom] = useState<boolean>(
    Boolean(initial?.subCategory && !subCategoriesFor(initial.category).includes(initial.subCategory)),
  );

  function onCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value;
    setForm((p) => ({ ...p, category, subCategory: '' })); // reset sub on category change
    setSubCustom(false);
  }

  function onSubSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === '__other__') { setSubCustom(true); setForm((p) => ({ ...p, subCategory: '' })); }
    else { setSubCustom(false); setForm((p) => ({ ...p, subCategory: v })); }
  }

  // Create the product first (needed for image/tryon upload folder), then return its id.
  // Guarded against races: concurrent callers (AI "Generate all" fires catalog +
  // try-on uploads back-to-back before React commits form.id) share ONE create
  // via createIdRef/creatingRef — otherwise two products (JF-0006 + JF-0007) were made.
  const createIdRef = useRef<string | null>(initial?.id ?? null);
  const creatingRef = useRef<Promise<string | null> | null>(null);

  async function ensureProductId(): Promise<string | null> {
    if (createIdRef.current) return createIdRef.current;
    if (form.id) { createIdRef.current = form.id; return form.id; }
    if (creatingRef.current) return creatingRef.current; // another call is already creating
    creatingRef.current = (async () => {
      const res = await fetch('/api/manufacturer/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json()) as { data?: { id: string; designNumber: string }; error?: { message: string } };
      if (!res.ok || !json.data) { setError(json.error?.message ?? 'Could not create product'); return null; }
      createIdRef.current = json.data.id;
      setForm((p) => ({ ...p, id: json.data!.id, designNumber: json.data!.designNumber }));
      return json.data.id;
    })();
    try { return await creatingRef.current; }
    finally { creatingRef.current = null; }
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

  async function deleteProduct() {
    const id = form.id;
    if (!id) return;
    if (!confirm('Delete this design? This removes its images and try-on asset. Cannot be undone.')) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/manufacturer/products/${id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      if (!res.ok) { setError(json?.error?.message ?? 'Could not delete'); return; }
      router.push('/manufacturer/catalog');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    } finally { setBusy(false); }
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

      {/* Specs — filled FIRST (before AI generate) */}
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.category} onChange={onCategoryChange}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sub-category <span className="font-normal">(optional)</span></label>
            {subOptions.length > 0 && !subCustom ? (
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.subCategory}
                onChange={onSubSelectChange}
                disabled={!form.category}
              >
                <option value="">—</option>
                {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__other__">Other (type your own)…</option>
              </select>
            ) : (
              <div className="mt-1 flex gap-2">
                <Input
                  placeholder={form.category ? 'Type a sub-category' : 'Select a category first'}
                  value={form.subCategory}
                  onChange={set('subCategory')}
                  disabled={!form.category}
                />
                {subOptions.length > 0 && (
                  <button type="button" onClick={() => { setSubCustom(false); setForm((p) => ({ ...p, subCategory: '' })); }} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                    List
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </section>

      {/* ── Generate with AI (optional) ─────────────────────────────────────
          Specs are filled above → upload a raw photo → AI fills name + description,
          and makes an attractive catalog image + a transparent try-on PNG. Everything
          stays editable. If AI isn't configured, this whole block is hidden and manual
          add works exactly as before. */}
      {aiEnabled && (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Generate with AI</span>
            <span className="text-xs text-muted-foreground">(optional — from a raw photo)</span>
          </div>

          {!form.category && (
            <p className="text-xs text-amber-700">Pick a Category above to enable AI.</p>
          )}

          <div className="flex flex-wrap items-start gap-3">
            {/* Raw photo (only after a category is chosen) */}
            {aiRawPreview ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={aiRawPreview} alt="raw" className="h-full w-full object-cover" />
                <button type="button" onClick={() => { setAiRaw(null); setAiRawPreview(null); }} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button type="button" disabled={!form.category} onClick={() => aiInput.current?.click()} title={!form.category ? 'Pick a category first' : undefined} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                <Upload className="h-5 w-5" /><span className="text-[10px] text-center leading-tight">Raw photo</span>
              </button>
            )}
            <input ref={aiInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickRaw(e.target.files[0])} />

            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">Generate (edit anything after):</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={!aiRaw || !!aiBusy} onClick={() => aiDescribe(false)} className="metal-sheen text-[#17120b] font-semibold">
                  {aiBusy === 'describe' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Name + Description</>}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy} onClick={() => aiCatalog(false)}>
                  {aiBusy === 'catalog' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Catalog image</>}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy} onClick={() => aiTransparent(false)}>
                  {aiBusy === 'transparent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Try-on PNG ({tryonType})</>}
                </Button>
                <Button type="button" size="sm" disabled={!aiRaw || !!aiBusy} onClick={aiGenerateAll} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {aiBusy === 'all' ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Generating…</> : <><Wand2 className="mr-1 h-3.5 w-3.5" />Generate all</>}
                </Button>
              </div>

              {/* Regenerate with a custom instruction */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder="Regenerate note, e.g. simpler background, warmer light" className="h-8 max-w-xs text-xs" />
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy || !aiInstr.trim()} onClick={() => aiCatalog(true)} title="Regenerate catalog with this instruction">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Catalog
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy || !aiInstr.trim()} onClick={() => aiTransparent(true)} title="Regenerate try-on with this instruction">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Try-on
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy || !aiInstr.trim()} onClick={() => aiDescribe(true)} title="Rewrite name/description with this instruction">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Text
                </Button>
              </div>
            </div>
          </div>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
          <p className="text-[11px] text-muted-foreground">AI fills the name + description above and the photos below — review and edit anything, then Save. The raw photo is only used for generation (not saved).</p>
        </section>
      )}

      {/* Name + remaining fields (after AI generate) */}
      <section className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Design Name *</label>
          <Input className="mt-1" placeholder="e.g. Lotus Jhumka Set" value={form.name} onChange={set('name')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Min Order Qty</label>
            <Input className="mt-1" type="number" min="1" value={form.minOrderQty} onChange={set('minOrderQty')} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active (visible)</option>
              <option value="DRAFT">Draft (hidden from stores)</option>
            </select>
          </div>
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
              <img src={img.secureUrl} alt="" onClick={() => setZoom({ src: img.secureUrl })} className="h-full w-full cursor-zoom-in object-cover" title="Click to enlarge" />
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
            <img src={tryon.assetUrl} alt="try-on" onClick={() => setZoom({ src: tryon.assetUrl, checker: true })} title="Click to enlarge" className="h-20 w-20 cursor-zoom-in rounded-lg border object-contain bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]" />
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

      {/* Description — moved to the bottom, after photos + AR try-on. */}
      <section>
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]" placeholder="Design details, motif, occasion." value={form.description} onChange={set('description')} />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/manufacturer/catalog')}>Cancel</Button>
        {(isEdit || form.id) && (
          <Button variant="outline" onClick={deleteProduct} disabled={busy} className="ml-auto border-red-200 text-red-700 hover:bg-red-50">
            <Trash2 className="mr-1.5 h-4 w-4" />Delete design
          </Button>
        )}
      </div>

      {/* Click-to-enlarge lightbox for generated catalog + try-on images */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.src}
            alt="preview"
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[85vh] max-w-[85vw] rounded-lg object-contain ${zoom.checker ? 'bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:24px_24px]' : ''}`}
          />
        </div>
      )}
    </div>
  );
}
