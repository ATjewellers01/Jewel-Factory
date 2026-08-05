'use client';

import { CheckCircle2, Loader2, PencilLine, Upload, X, ShieldCheck, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/hooks/use-api';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';
import { fieldError, toFieldErrors } from '@/lib/field-error';

const PURITIES = ['24K', '22K', '18K', '14K', '916', '750', '585'];
const MEENA_OPTIONS = ['Yes', 'No'];
const SCREW_OPTIONS = ['English', 'Pongli'];

/** Formats a weight input to exactly 3 decimal places on blur (e.g. "20.350"). */
function formatWeight3(value: string): string {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) ? n.toFixed(3) : value;
}

const MAX_IMAGES = 10;

const EMPTY_FORM = {
  orderRef: '', deliveryDate: '',
  category: CATEGORIES[0], subCategory: '',
  quantity: '', weightFrom: '', weightTo: '', purity: '',
  meena: '', length: '', size: '', broadness: '', screw: '', sampleWeight: '',
  notes: '',
};

export default function StoreCustomDesignNewPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [subCustom, setSubCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }
  const subOptions = subCategoriesFor(form.category);

  async function handleUpload(files: FileList) {
    setError(null); setUploading(true);
    try {
      const room = MAX_IMAGES - images.length;
      const toUpload = Array.from(files).slice(0, Math.max(room, 0));
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const signRes = await fetch('/api/store/custom-designs/upload-sign', { method: 'POST', credentials: 'same-origin' });
        if (signRes.status === 401) { window.location.assign('/store/login'); return; }
        const signJson = (await signRes.json()) as { data?: { uploadUrl: string; secureUrl: string; maxBytes: number }; error?: { message: string } };
        if (!signRes.ok || !signJson.data) { setError(signJson.error?.message ?? 'Upload unavailable.'); return; }
        const s = signJson.data;
        if (file.size > s.maxBytes) { setError(`Image too large (max ${Math.round(s.maxBytes / 1024 / 1024)}MB).`); continue; }
        const upRes = await fetch(s.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!upRes.ok) { setError(`Upload failed (${upRes.status}).`); continue; }
        uploaded.push(s.secureUrl);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setUploading(false); }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitErr(null);

    if (images.length === 0) { setError('Please add at least one reference image.'); return; }

    const from = form.weightFrom ? Number(form.weightFrom) : undefined;
    const to = form.weightTo ? Number(form.weightTo) : undefined;
    let weightGramsMin = from ?? to;
    let weightGramsMax = to ?? from;
    if (from !== undefined && to !== undefined && to < from) {
      weightGramsMin = to;
      weightGramsMax = from;
    }

    setLoading(true);
    try {
      const result = (await apiPost('/api/store/custom-designs', {
        category: form.category,
        subCategory: form.subCategory.trim() || undefined,
        weightGramsMin,
        weightGramsMax,
        purity: form.purity || undefined,
        designNotes: form.notes.trim() || undefined,
        referenceImageUrl: images[0],
        referenceImageUrls: images,
        orderRef: form.orderRef.trim() || undefined,
        deliveryDate: form.deliveryDate || undefined,
        quantity: form.quantity.trim() || undefined,
        meena: form.meena || undefined,
        length: form.length.trim() || undefined,
        size: form.size.trim() || undefined,
        broadness: form.broadness.trim() || undefined,
        screw: form.screw || undefined,
        sampleWeightGrams: form.sampleWeight ? Number(form.sampleWeight) : undefined,
      })) as { orderNumber?: string };
      setPlacedOrderNumber(result.orderNumber ?? null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
      setSubmitErr(err);
    } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="mt-4 font-display text-2xl font-medium">Order placed</h1>
        {placedOrderNumber && (
          <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-[#a0824a]">{placedOrderNumber}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Forwarded to the manufacturer.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => { setDone(false); setForm(EMPTY_FORM); setImages([]); setPlacedOrderNumber(null); }}>New order</Button>
          <Link href="/store/b2b-orders"><Button className="metal-sheen text-[#17120b] font-semibold">Back to Order History</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(46rem_18rem_at_20%_-20%,rgba(201,168,76,0.14),transparent_65%)]" />

      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">
          <PencilLine className="h-3.5 w-3.5" /> Customised order
        </p>
        <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">Place a customised order</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Capture the design requirement and a reference image — this goes straight to the manufacturer.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.85fr] lg:gap-8">
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-black/10 bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          {/* Order number (orderRef, the shop's own reference) is hidden from
              this form per client request — still captured as undefined, the
              field simply isn't shown/collected here anymore. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Delivery date</label>
              <Input required type="date" className="mt-1 h-10" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'deliveryDate'))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.category} onChange={(e) => { set('category', e.target.value); set('subCategory', ''); setSubCustom(false); }}>
                {CATEGORIES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
              </select>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'category'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sub-category</label>
              {subOptions.length > 0 && !subCustom ? (
                <select required className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.subCategory} onChange={(e) => { if (e.target.value === '__other__') { setSubCustom(true); set('subCategory', ''); } else set('subCategory', e.target.value); }}>
                  <option value="">—</option>
                  {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__other__">Other (type your own)…</option>
                </select>
              ) : (
                <div className="mt-1 flex gap-2">
                  <Input required placeholder="Type a sub-category" value={form.subCategory} onChange={(e) => set('subCategory', e.target.value)} />
                  {subOptions.length > 0 && <button type="button" onClick={() => { setSubCustom(false); set('subCategory', ''); }} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">List</button>}
                </div>
              )}
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'subCategory'))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <div className="mt-1 flex items-center gap-2">
                <Input required placeholder="e.g. 2 pcs" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className="h-10" />
              </div>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'quantity'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sample weight (g)</label>
              <Input
                required
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                placeholder="0.000"
                value={form.sampleWeight}
                onChange={(e) => set('sampleWeight', e.target.value)}
                onBlur={(e) => set('sampleWeight', formatWeight3(e.target.value))}
                className="mt-1 h-10"
              />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'sampleWeightGrams'))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Weight range (g)</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  placeholder="From"
                  value={form.weightFrom}
                  onChange={(e) => set('weightFrom', e.target.value)}
                  onBlur={(e) => set('weightFrom', formatWeight3(e.target.value))}
                  className="h-10"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  placeholder="To"
                  value={form.weightTo}
                  onChange={(e) => set('weightTo', e.target.value)}
                  onBlur={(e) => set('weightTo', formatWeight3(e.target.value))}
                  className="h-10"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Leave &ldquo;To&rdquo; blank for an exact weight.</p>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'weightGramsMin') ?? fieldError(submitErr, 'weightGramsMax'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Melting / purity</label>
              <select className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.purity} onChange={(e) => set('purity', e.target.value)}>
                <option value="">—</option>
                {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'purity'))} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meena / colouring</label>
              <select required className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.meena} onChange={(e) => set('meena', e.target.value)}>
                <option value="">—</option>
                {MEENA_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'meena'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Screw</label>
              <select required className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.screw} onChange={(e) => set('screw', e.target.value)}>
                <option value="">—</option>
                {SCREW_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'screw'))} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Length <span className="normal-case text-muted-foreground/70">(optional)</span></label>
              <Input className="mt-1 h-10" placeholder="e.g. 18 inch" value={form.length} onChange={(e) => set('length', e.target.value)} />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'length'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Size <span className="normal-case text-muted-foreground/70">(optional)</span></label>
              <Input className="mt-1 h-10" placeholder="e.g. 2.6 or 2.6.5" value={form.size} onChange={(e) => set('size', e.target.value)} />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'size'))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Broadness <span className="normal-case text-muted-foreground/70">(optional)</span></label>
              <Input className="mt-1 h-10" placeholder="e.g. 8 mm" value={form.broadness} onChange={(e) => set('broadness', e.target.value)} />
              <FieldError errors={toFieldErrors(fieldError(submitErr, 'broadness'))} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Reference images</label>
              <span className="text-[11px] text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="reference" className="h-28 w-28 rounded-xl border object-cover" />
                  <button type="button" onClick={() => removeImage(url)} className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <>
                  <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
                    className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/15 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60">
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                    <span className="text-xs">{uploading ? 'Uploading…' : 'Add photo'}</span>
                  </button>
                  <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleUpload(e.target.files)} />
                </>
              )}
            </div>
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'referenceImageUrl') ?? fieldError(submitErr, 'referenceImageUrls'))} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Remarks</label>
            <textarea className="mt-1 min-h-[130px] w-full rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm" placeholder="Describe the design — style, size, engraving, timeline…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'designNotes'))} />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Button type="submit" disabled={loading} className="metal-sheen h-11 w-full rounded-full text-sm font-semibold text-[#17120b]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-4 w-4" /> Place order</>}
          </Button>
        </form>

        <aside className="space-y-4 lg:pt-1">
          <div className="rounded-2xl border border-black/10 bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a0824a]">What happens next</p>
            <ol className="mt-4 space-y-3">
              {[
                'Your order is forwarded straight to the manufacturer.',
                'Track its status from Customised Orders.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <span className="text-sm leading-6 text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Customer privacy.</span> No customer name, phone, or address is
              collected here — only the design requirement travels onward.
            </p>
          </div>
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[#b68a3e]" /> Gold only · No price shown
          </div>
        </aside>
      </div>
    </div>
  );
}
