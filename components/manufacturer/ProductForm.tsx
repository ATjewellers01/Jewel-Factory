'use client';

import { Loader2, Upload, X, Trash2, Sparkles, RefreshCw, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Optional } from '@/components/ui/field-mark';
import { Input } from '@/components/ui/input';
import { uploadToObjectStorage } from '@/lib/upload-client';
import { toFieldErrors } from '@/lib/field-error';
import { EditableSelect, type TaxonomyOption } from '@/components/manufacturer/EditableSelect';
import { apiPost } from '@/hooks/use-api';

const JEWELLERY_TYPES = ['necklace', 'earring_left', 'earring_right', 'ring_index', 'ring_middle', 'bangle'] as const;

// Auto-suggest the AR try-on jewellery type from the selected category — the
// "Jewellery type" dropdown used to always default to 'necklace' regardless of
// category, so picking "Bangles" and clicking Generate All silently produced a
// necklace-shaped try-on asset for a bangle. Categories with no clean 1:1 AR
// mapping (Bindiya/Mangtika, Ear Chain Kannoti, JF Coin, Men's Collection,
// Nath/Nose Ring) are left out — the manufacturer picks manually for those.
const CATEGORY_TO_JEWELLERY_TYPE: Record<string, (typeof JEWELLERY_TYPES)[number]> = {
  Bangles: 'bangle',
  Bracelet: 'bangle',
  Chain: 'necklace',
  Earrings: 'earring_left',
  Mangalsutra: 'necklace',
  Pendants: 'necklace',
  Rings: 'ring_middle',
  Set: 'necklace',
  Watch: 'bangle',
};

export type ProductFormData = {
  id?: string;
  name?: string;
  category: string;
  subCategory: string; // "Sub-category 1" in the form — manufacturer-editable, see EditableSelect
  subCategory2: string; // "Sub-category 2" in the form — manufacturer-editable, own list per category
  description: string;
  // Deprecated — kept only so an older product's legacy single-weight value
  // still round-trips through this form's initial state if ever loaded; the
  // form itself no longer renders or edits this field (every category now
  // always captures Gross/Net Weight below, see 2026-08-17 rework).
  weightGrams: string;
  grossWeightGrams: string;
  netWeightGrams: string;
  purity: string;
  minOrderQty: string;
  pieces: string;
  size: string; // bangle size — only shown/sent for the Bangles category
  karigarCode: string;
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

  const [form, setForm] = useState<ProductFormData>(
    initial ?? {
      name: '', category: '', subCategory: '', subCategory2: '', description: '',
      weightGrams: '', grossWeightGrams: '', netWeightGrams: '',
      purity: '', minOrderQty: '1', pieces: '1', size: '', karigarCode: '',
      status: 'ACTIVE', // new designs are visible by default
    },
  );
  const [images, setImages] = useState(initial?.images ?? []);
  const [tryon, setTryon] = useState(initial?.tryon ?? null);
  const [tryonType, setTryonType] = useState<string>(initial?.tryon?.jewelleryType ?? 'necklace');
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingTryon, setUploadingTryon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<{ src: string; checker?: boolean } | null>(null); // click-to-enlarge preview

  // ── Manufacturer-editable taxonomy (Category / Sub-category 1 / Sub-category
  // 2 / Purity — 2026-08-17) — replaces the old hardcoded lib/categories.ts
  // list. Loaded once; category/subCategory/subCategory2/purity in `form`
  // stay NAME strings (that's what ManufacturerProduct's columns store), the
  // EditableSelect dropdowns below resolve name <-> id against this tree.
  type TaxonomyCategory = { id: string; name: string; subCategories1: TaxonomyOption[]; subCategories2: TaxonomyOption[] };
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [purities, setPurities] = useState<TaxonomyOption[]>([]);
  const [taxonomyLoaded, setTaxonomyLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manufacturer/taxonomy', { cache: 'no-store', credentials: 'same-origin' });
        const json = (await res.json()) as { data?: { categories: TaxonomyCategory[]; purities: TaxonomyOption[] } };
        setCategories(json.data?.categories ?? []);
        setPurities(json.data?.purities ?? []);
      } finally {
        setTaxonomyLoaded(true);
      }
    })();
  }, []);

  const selectedCategory = categories.find((c) => c.name === form.category) ?? null;
  const subCategory1Options = selectedCategory?.subCategories1 ?? [];
  const subCategory2Options = selectedCategory?.subCategories2 ?? [];

  async function addCategory(name: string): Promise<TaxonomyOption> {
    const created = (await apiPost('/api/manufacturer/taxonomy/categories', { name })) as { id: string; name: string };
    setCategories((prev) => [...prev, { id: created.id, name: created.name, subCategories1: [], subCategories2: [] }]);
    return created;
  }
  async function removeCategoryOption(option: TaxonomyOption) {
    const res = await fetch(`/api/manufacturer/taxonomy/categories/${option.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      return { ok: false, error: json?.error?.message ?? 'Could not remove' };
    }
    setCategories((prev) => prev.filter((c) => c.id !== option.id));
    return { ok: true };
  }

  async function addSubCategory1(name: string): Promise<TaxonomyOption> {
    if (!selectedCategory) throw new Error('Select a category first');
    const created = (await apiPost('/api/manufacturer/taxonomy/sub-categories-1', { categoryId: selectedCategory.id, name })) as TaxonomyOption;
    setCategories((prev) => prev.map((c) => (c.id === selectedCategory.id ? { ...c, subCategories1: [...c.subCategories1, created] } : c)));
    return created;
  }
  async function removeSubCategory1Option(option: TaxonomyOption) {
    const res = await fetch(`/api/manufacturer/taxonomy/sub-categories-1/${option.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      return { ok: false, error: json?.error?.message ?? 'Could not remove' };
    }
    setCategories((prev) => prev.map((c) => ({ ...c, subCategories1: c.subCategories1.filter((s) => s.id !== option.id) })));
    return { ok: true };
  }

  async function addSubCategory2(name: string): Promise<TaxonomyOption> {
    if (!selectedCategory) throw new Error('Select a category first');
    const created = (await apiPost('/api/manufacturer/taxonomy/sub-categories-2', { categoryId: selectedCategory.id, name })) as TaxonomyOption;
    setCategories((prev) => prev.map((c) => (c.id === selectedCategory.id ? { ...c, subCategories2: [...c.subCategories2, created] } : c)));
    return created;
  }
  async function removeSubCategory2Option(option: TaxonomyOption) {
    const res = await fetch(`/api/manufacturer/taxonomy/sub-categories-2/${option.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      return { ok: false, error: json?.error?.message ?? 'Could not remove' };
    }
    setCategories((prev) => prev.map((c) => ({ ...c, subCategories2: c.subCategories2.filter((s) => s.id !== option.id) })));
    return { ok: true };
  }

  async function addPurity(name: string): Promise<TaxonomyOption> {
    const created = (await apiPost('/api/manufacturer/taxonomy/purities', { name })) as TaxonomyOption;
    setPurities((prev) => [...prev, created]);
    return created;
  }
  async function removePurityOption(option: TaxonomyOption) {
    const res = await fetch(`/api/manufacturer/taxonomy/purities/${option.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      return { ok: false, error: json?.error?.message ?? 'Could not remove' };
    }
    setPurities((prev) => prev.filter((p) => p.id !== option.id));
    return { ok: true };
  }

  // ── AI generate (raw image -> name/description + catalog + transparent) ──────
  const aiInput = useRef<HTMLInputElement>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiRaw, setAiRaw] = useState<File | null>(null);      // temp raw image (not saved)
  const [aiRawPreview, setAiRawPreview] = useState<string | null>(null);
  const [aiInstr, setAiInstr] = useState('');                 // regenerate custom instruction
  const [aiBusy, setAiBusy] = useState<string | null>(null);  // 'all' | 'describe' | 'catalog' | 'transparent'
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRawZoom, setAiRawZoom] = useState<string | null>(null); // raw image zoom preview

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
    const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_IMAGE_SIZE) {
      setAiError(`Image too large. Max 15MB allowed. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      setAiRaw(null);
      setAiRawPreview(null);
      return;
    }
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

  function aiFormWithCategory(extra?: boolean): FormData {
    const fd = aiForm(extra);
    if (form.category) fd.append('category', form.category);
    if (form.subCategory) fd.append('subCategory', form.subCategory);
    return fd;
  }

  async function b64ToFile(b64: string, name: string): Promise<File> {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new File([bytes], name, { type: 'image/png' });
  }

  // Describe: fill name + description (editable). Returns the new name (so the
  // "generate all" flow can pass it to catalog/transparent without waiting for
  // React state to update).
  async function aiDescribe(withInstr = false): Promise<{ description: string } | null> {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return null; }
    setAiBusy('describe'); setAiError(null);
    try {
      const fd = aiForm(withInstr);
      fd.append('category', form.category); fd.append('subCategory', form.subCategory);
      fd.append('weight', form.weightGrams); fd.append('purity', form.purity);
      const res = await fetch('/api/manufacturer/ai/describe', { method: 'POST', credentials: 'same-origin', body: fd });
      const json = (await res.json()) as { data?: { description: string }; error?: { message: string } };
      console.log('[ai:describe]', res.status, json);
      if (!res.ok || !json.data) throw new Error(`Describe failed (HTTP ${res.status}): ${json.error?.message ?? 'no details returned'}`);
      setForm((p) => ({ ...p, description: json.data!.description || p.description }));
      return json.data;
    } catch (e) {
      console.error('[ai:describe] failed', e);
      setAiError(e instanceof Error ? e.message : 'Describe failed');
      return null;
    } finally { setAiBusy(null); }
  }

  // Catalogue: generate an attractive image and add it as a product photo.
  async function aiCatalog(withInstr = false): Promise<boolean> {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return false; }
    setAiBusy('catalog'); setAiError(null);
    try {
      const res = await fetch('/api/manufacturer/ai/catalog', { method: 'POST', credentials: 'same-origin', body: aiFormWithCategory(withInstr) });
      const json = (await res.json()) as { data?: { imageBase64: string }; error?: { message: string } };
      console.log('[ai:catalog]', res.status, { ...json, data: json.data ? '<image omitted>' : json.data });
      if (!res.ok || !json.data) throw new Error(`Catalogue generation failed (HTTP ${res.status}): ${json.error?.message ?? 'no details returned'}`);
      const file = await b64ToFile(json.data.imageBase64, 'ai-catalog.png');
      await handleImageUpload(file);
      return true;
    } catch (e) {
      console.error('[ai:catalog] failed', e);
      setAiError(e instanceof Error ? e.message : 'Catalogue generation failed');
      return false;
    } finally { setAiBusy(null); }
  }

  // Transparent: generate a background-free PNG and set it as the try-on asset.
  async function aiTransparent(withInstr = false): Promise<boolean> {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return false; }
    setAiBusy('transparent'); setAiError(null);
    try {
      const fd = aiFormWithCategory(withInstr);
      fd.append('jewelleryType', tryonType);
      const res = await fetch('/api/manufacturer/ai/transparent', { method: 'POST', credentials: 'same-origin', body: fd });
      const json = (await res.json()) as { data?: { imageBase64: string }; error?: { message: string } };
      console.log('[ai:transparent]', res.status, { ...json, data: json.data ? '<image omitted>' : json.data });
      if (!res.ok || !json.data) throw new Error(`Transparent generation failed (HTTP ${res.status}): ${json.error?.message ?? 'no details returned'}`);
      const file = await b64ToFile(json.data.imageBase64, 'ai-tryon.png');
      await handleTryonUpload(file);
      return true;
    } catch (e) {
      console.error('[ai:transparent] failed', e);
      setAiError(e instanceof Error ? e.message : 'Transparent generation failed');
      return false;
    } finally { setAiBusy(null); }
  }

  // Generate everything at once: description → create product → catalog image → try-on PNG.
  async function aiGenerateAll() {
    if (!aiRaw) { setAiError('Choose a raw photo first.'); return; }
    setAiBusy('all'); setAiError(null);
    console.log('[ai:generate-all] start');
    try {
      // Step 1: AI generates description
      console.log('[ai:generate-all] step 1/4 — describe');
      const described = await aiDescribe(false);
      if (!described) {
        console.error('[ai:generate-all] aborted at step 1 (describe) — see [ai:describe] logs above');
        setAiBusy(null);
        return;
      }

      // Step 2: Update form with description. Read explicitly off `described` to avoid stale closure issues.
      const updatedForm = { ...form, description: described.description || form.description };
      setForm(updatedForm);

      // Step 3: Create product immediately (generates design number) before images
      console.log('[ai:generate-all] step 2/4 — create product');
      setBusy(true);
      const res = await fetch('/api/manufacturer/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: updatedForm.category || undefined,
          subCategory: updatedForm.subCategory || undefined,
          description: updatedForm.description || undefined,
          weightGrams: updatedForm.weightGrams ? Number(updatedForm.weightGrams) : undefined,
          purity: updatedForm.purity || undefined,
          minOrderQty: updatedForm.minOrderQty ? Number(updatedForm.minOrderQty) : 1,
          status: updatedForm.status,
        }),
      });
      const json = (await res.json()) as { data?: { id: string; designNumber: string }; error?: { message: string } };
      console.log('[ai:generate-all] create product response', res.status, json);
      if (!res.ok || !json.data) throw new Error(`Could not create product (HTTP ${res.status}): ${json.error?.message ?? 'no details returned'}`);

      const productId = json.data.id;
      const designNumber = json.data.designNumber;
      createIdRef.current = productId;
      setForm((p) => ({ ...p, id: productId, designNumber }));
      setBusy(false);

      // Step 4: Generate catalog image
      console.log('[ai:generate-all] step 3/3 — catalog image');
      const catalogOk = await aiCatalog(false);
      console.log(catalogOk ? '[ai:generate-all] done' : '[ai:generate-all] step 3 (catalog) failed — see [ai:catalog] logs above');
      // Note: Try-on PNG generation is manual-only (Generate Try-On button in the AR section below).
    } catch (e) {
      console.error('[ai:generate-all] failed', e);
      setAiError(e instanceof Error ? e.message : 'Generate all failed');
      setBusy(false);
    } finally {
      setAiBusy(null);
    }
  }

  // Generate try-on from an existing catalog image (edit mode or manually selected)
  async function generateTryOnFromImage(imageUrl: string) {
    setAiError(null);
    setAiBusy('transparent');
    try {
      // Fetch the image from S3 and convert to File
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Could not fetch image');
      const blob = await response.blob();
      const file = new File([blob], 'catalog-image.jpg', { type: blob.type });

      // Set as raw image for AI processing (same flow as user upload)
      setAiRaw(file);
      setAiRawPreview(imageUrl);

      // Generate try-on using this image
      const fd = new FormData();
      fd.append('image', file, file.name);
      fd.append('category', form.category);
      fd.append('subCategory', form.subCategory);
      fd.append('jewelleryType', tryonType);

      const res = await fetch('/api/manufacturer/ai/transparent', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const json = (await res.json()) as { data?: { imageBase64: string }; error?: { message: string } };
      console.log('[ai:transparent-from-catalog]', res.status, json);
      if (!res.ok || !json.data) throw new Error(`Transparent generation failed (HTTP ${res.status}): ${json.error?.message ?? 'no details returned'}`);

      const tryonFile = await b64ToFile(json.data.imageBase64, 'ai-tryon.png');
      await handleTryonUpload(tryonFile);
      console.log('[ai:transparent-from-catalog] done');
    } catch (e) {
      console.error('[ai:transparent-from-catalog] failed', e);
      setAiError(e instanceof Error ? e.message : 'Try-on generation failed');
    } finally {
      setAiBusy(null);
    }
  }

  const set = (k: keyof ProductFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  // Size is a bangle-only spec (2.2, 2.4, 2.6 …) — no other category uses it.
  const showSize = form.category === 'Bangles';

  function onCategoryPick(option: TaxonomyOption | null) {
    const category = option?.name ?? '';
    // Reset both sub-categories on category change — Sub-category 1 and
    // Sub-category 2 are each scoped to their OWN parent category (own list
    // per category, 2026-08-17), so a stale value from the old category
    // wouldn't be valid in the new one's list.
    setForm((p) => ({ ...p, category, subCategory: '', subCategory2: '' }));
    // Keep the AR "Jewellery type" dropdown in sync with the category so
    // Generate All doesn't silently produce a necklace-shaped try-on for a
    // bangle (or similar mismatch) just because the manufacturer forgot to
    // switch it manually.
    const suggested = category ? CATEGORY_TO_JEWELLERY_TYPE[category] : undefined;
    if (suggested) setTryonType(suggested);
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
      const json = (await res.json()) as { data?: { id: string; designNumber: string }; error?: { message: string; fields?: Record<string, string> } };
      if (!res.ok || !json.data) {
        setError(json.error?.message ?? 'Could not create product');
        setFieldErrors(json.error?.fields ?? {});
        return null;
      }
      createIdRef.current = json.data.id;
      setForm((p) => ({ ...p, id: json.data!.id, designNumber: json.data!.designNumber }));
      return json.data.id;
    })();
    try { return await creatingRef.current; }
    finally { creatingRef.current = null; }
  }

  function buildPayload() {
    return {
      category: form.category || undefined,
      subCategory: form.subCategory || undefined,
      subCategory2: form.subCategory2 || null,
      description: form.description || undefined,
      // Every category now always captures Gross/Net Weight (2026-08-17) —
      // weightGrams (the old single-field value) is never written by this
      // form anymore, only read back for legacy rows (see the type comment).
      weightGrams: null,
      grossWeightGrams: form.grossWeightGrams ? Number(form.grossWeightGrams) : null,
      netWeightGrams: form.netWeightGrams ? Number(form.netWeightGrams) : null,
      purity: form.purity || undefined,
      minOrderQty: form.minOrderQty ? Number(form.minOrderQty) : 1,
      pieces: form.pieces ? Number(form.pieces) : 1,
      // Sent as null off the Bangles category so switching category clears a
      // size that was entered earlier, rather than leaving it orphaned.
      size: showSize ? (form.size.trim() || null) : null,
      // null (not undefined) when cleared — undefined means "don't touch this
      // field" server-side, so an emptied field would otherwise silently keep
      // its old value instead of clearing.
      karigarCode: form.karigarCode.trim() || null,
      status: form.status,
    };
  }

  async function handleImageUpload(file: File) {
    setError(null);
    const id = await ensureProductId();
    if (!id) return;
    setUploadingImage(true);
    try {
      const { secureUrl, publicId } = await uploadToObjectStorage(`/api/manufacturer/products/${id}/images/sign`, file);
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
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setError('Try-on asset must be a transparent PNG.');
      return;
    }
    const id = await ensureProductId();
    if (!id) return;
    setUploadingTryon(true);
    try {
      const { secureUrl, publicId } = await uploadToObjectStorage(`/api/manufacturer/products/${id}/tryon/sign`, file);
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
    setFieldErrors({});
    setBusy(true);
    try {
      const id = await ensureProductId();
      if (!id) return;
      // Same PATCH either way — if it already existed, patch its fields; if it
      // was just created via ensureProductId, patch too in case the user
      // edited fields after uploading an image (which created it).
      const res = await fetch(`/api/manufacturer/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json().catch(() => null)) as { error?: { message: string; fields?: Record<string, string> } } | null;
      if (!res.ok || json?.error) {
        setError(json?.error?.message ?? 'Could not save');
        setFieldErrors(json?.error?.fields ?? {});
        return;
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
            <EditableSelect
              label="Category"
              placeholder="Select category"
              value={selectedCategory?.id ?? ''}
              options={categories}
              disabled={!taxonomyLoaded}
              onPick={onCategoryPick}
              onAdd={addCategory}
              onRemove={removeCategoryOption}
            />
            <FieldError errors={toFieldErrors(fieldErrors.category)} />
          </div>
          <div>
            <EditableSelect
              label={<>Sub-category 1<Optional /></>}
              placeholder="—"
              value={subCategory1Options.find((s) => s.name === form.subCategory)?.id ?? ''}
              options={subCategory1Options}
              disabled={!form.category}
              onPick={(o) => setForm((p) => ({ ...p, subCategory: o?.name ?? '' }))}
              onAdd={addSubCategory1}
              onRemove={removeSubCategory1Option}
            />
            <FieldError errors={toFieldErrors(fieldErrors.subCategory)} />
          </div>
          <div>
            <EditableSelect
              label={<>Sub-category 2<Optional /></>}
              placeholder="—"
              value={subCategory2Options.find((s) => s.name === form.subCategory2)?.id ?? ''}
              options={subCategory2Options}
              disabled={!form.category}
              onPick={(o) => setForm((p) => ({ ...p, subCategory2: o?.name ?? '' }))}
              onAdd={addSubCategory2}
              onRemove={removeSubCategory2Option}
            />
            <FieldError errors={toFieldErrors(fieldErrors.subCategory2)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Every category always captures Gross/Net Weight (2026-08-17) —
              there is no more single Weight field / Plain-Studded switch. */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Gross Weight (gm)<Optional /></label>
            <Input className="mt-1" type="number" step="0.001" placeholder="12.5" value={form.grossWeightGrams} onChange={set('grossWeightGrams')} />
            <FieldError errors={toFieldErrors(fieldErrors.grossWeightGrams)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Net Weight (gm)<Optional /></label>
            <Input className="mt-1" type="number" step="0.001" placeholder="10.2" value={form.netWeightGrams} onChange={set('netWeightGrams')} />
            <FieldError errors={toFieldErrors(fieldErrors.netWeightGrams)} />
          </div>
          <div>
            <EditableSelect
              label={<>Purity<Optional /></>}
              placeholder="—"
              value={purities.find((p) => p.name === form.purity)?.id ?? ''}
              options={purities}
              disabled={!taxonomyLoaded}
              onPick={(o) => setForm((p) => ({ ...p, purity: o?.name ?? '' }))}
              onAdd={addPurity}
              onRemove={removePurityOption}
            />
            <FieldError errors={toFieldErrors(fieldErrors.purity)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Pieces<Optional /></label>
            <Input className="mt-1" type="number" min="1" step="1" placeholder="1" value={form.pieces} onChange={set('pieces')} title="How many physical pieces make up the weight above (e.g. a bangle pair = 2)" />
            <FieldError errors={toFieldErrors(fieldErrors.pieces)} />
          </div>
          {/* Sits alongside Pieces — it's a dimension of the piece, and only
              the Bangles category collects it. */}
          {showSize && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Size<Optional /></label>
              <Input className="mt-1" placeholder="e.g. 2.4" value={form.size} onChange={set('size')} title="Bangle size — free text, e.g. 2.4 or 2.6" />
              <FieldError errors={toFieldErrors(fieldErrors.size)} />
            </div>
          )}
        </div>
      </section>

      {/* Min Order Qty + Status fields */}
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Min Order Qty<Optional /></label>
            <Input className="mt-1" type="number" min="1" value={form.minOrderQty} onChange={set('minOrderQty')} />
            <FieldError errors={toFieldErrors(fieldErrors.minOrderQty)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active (visible)</option>
              <option value="DRAFT">Inactive (hidden from stores)</option>
            </select>
            <FieldError errors={toFieldErrors(fieldErrors.status)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Karigar Code <span className="text-[10px] normal-case text-muted-foreground/70">(internal only — never shown to purchase managers)</span></label>
          <Input className="mt-1" placeholder="e.g. K-104" value={form.karigarCode} onChange={set('karigarCode')} />
          <FieldError errors={toFieldErrors(fieldErrors.karigarCode)} />
        </div>
      </section>

      {/* ── Generate with AI (optional) ─────────────────────────────────────
          Specs are filled above → upload a raw photo → AI fills name + description,
          and makes an attractive catalogue image + a transparent try-on PNG. Everything
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
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border cursor-pointer group" onClick={() => setAiRawZoom(aiRawPreview)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL (URL.createObjectURL), next/image can't optimize local file previews */}
                <img src={aiRawPreview} alt="raw" className="h-full w-full object-cover group-hover:opacity-75 transition-opacity" title="Click to zoom" />
                <button type="button" onClick={(e) => { e.stopPropagation(); setAiRaw(null); setAiRawPreview(null); }} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
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
                  {aiBusy === 'describe' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Description</>}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy} onClick={() => aiCatalog(false)}>
                  {aiBusy === 'catalog' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="mr-1 h-3.5 w-3.5" />Catalogue image</>}
                </Button>
                <Button type="button" size="sm" disabled={!aiRaw || !!aiBusy} onClick={aiGenerateAll} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {aiBusy === 'all' ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Generating…</> : <><Wand2 className="mr-1 h-3.5 w-3.5" />Generate all</>}
                </Button>
              </div>

              {/* Regenerate with a custom instruction */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder="Regenerate note, e.g. simpler background, warmer light" className="h-8 max-w-xs text-xs" />
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy || !aiInstr.trim()} onClick={() => aiCatalog(true)} title="Regenerate catalog with this instruction">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Catalogue
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!aiRaw || !!aiBusy || !aiInstr.trim()} onClick={() => aiDescribe(true)} title="Regenerate description with this instruction">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Description
                </Button>
              </div>
            </div>
          </div>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
          <p className="text-[11px] text-muted-foreground">AI fills the name + description above and the photos below — review and edit anything, then Save. The raw photo is only used for generation (not saved).</p>

          {/* Raw image zoom modal */}
          {aiRawZoom && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAiRawZoom(null)}>
              <div className="relative max-h-[80vh] max-w-2xl overflow-auto" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL (URL.createObjectURL), next/image can't optimize local file previews */}
                <img src={aiRawZoom} alt="zoomed raw" className="max-w-full h-auto" />
                <button type="button" onClick={() => setAiRawZoom(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><X className="h-5 w-5" /></button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Photos */}
      <section className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catalogue Photos</label>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="flex flex-col gap-2">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border">
                <Image src={img.secureUrl} alt="" fill onClick={() => setZoom({ src: img.secureUrl })} className="cursor-zoom-in object-cover" title="Click to enlarge" />
                <button type="button" onClick={() => removeImage(img.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={uploadingImage || !form.id}
            title={!form.id ? 'Save the product first to upload photos' : undefined}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input disabled:hover:text-muted-foreground"
          >
            {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[10px]">Upload</span>
          </button>
          <input ref={imageInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
        </div>
      </section>

      {/* AR Try-On — only shown when a try-on asset already exists; the
          upload/generate controls are hidden (client request), so there's
          nothing useful to show here when there isn't one yet. */}
      {tryon && (
        <section className="space-y-2 rounded-xl border p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AR Try-On (transparent PNG)</label>
          <div className="flex items-center gap-3">
            <Image src={tryon.assetUrl} alt="try-on" width={80} height={80} onClick={() => setZoom({ src: tryon.assetUrl, checker: true })} title="Click to enlarge" className="cursor-zoom-in rounded-lg border object-contain bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]" />
            <div className="flex-1">
              <p className="text-sm">{tryon.jewelleryType}</p>
              <button type="button" onClick={removeTryon} className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Description — moved to the bottom, after photos + AR try-on. */}
      <section>
        <label className="text-xs font-medium text-muted-foreground">Description<Optional /></label>
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
          <Image
            src={zoom.src}
            alt="preview"
            width={1200}
            height={1200}
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[85vh] max-w-[85vw] rounded-lg object-contain ${zoom.checker ? 'bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:24px_24px]' : ''}`}
          />
        </div>
      )}
    </div>
  );
}
