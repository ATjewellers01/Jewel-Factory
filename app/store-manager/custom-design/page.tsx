'use client';

import { CheckCircle2, Loader2, PencilLine, Upload, X, ShieldCheck, Send, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/hooks/use-api';
import { CATEGORIES, subCategoriesFor } from '@/lib/categories';

const PURITIES = ['24K', '22K', '18K', '14K', '916', '750', '585'];

export default function StoreManagerCustomDesignPage() {
  const [form, setForm] = useState({ category: CATEGORIES[0], subCategory: '', weightFrom: '', weightTo: '', purity: '', notes: '', imageUrl: '' });
  const [subCustom, setSubCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }
  const subOptions = subCategoriesFor(form.category);

  async function handleUpload(file: File) {
    setError(null); setUploading(true);
    try {
      const signRes = await fetch('/api/branch-manager/custom-designs/upload-sign', { method: 'POST', credentials: 'same-origin' });
      if (signRes.status === 401) { window.location.assign('/store-manager/login'); return; }
      const signJson = (await signRes.json()) as { data?: { apiKey: string; timestamp: number; folder: string; signature: string; uploadUrl: string; maxBytes: number }; error?: { message: string } };
      if (!signRes.ok || !signJson.data) { setError(signJson.error?.message ?? 'Upload unavailable.'); return; }
      const s = signJson.data;
      if (file.size > s.maxBytes) { setError(`Image too large (max ${Math.round(s.maxBytes / 1024 / 1024)}MB).`); return; }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', s.apiKey);
      fd.append('timestamp', String(s.timestamp));
      fd.append('signature', s.signature);
      fd.append('folder', s.folder);
      const upRes = await fetch(s.uploadUrl, { method: 'POST', body: fd });
      const upJson = (await upRes.json()) as { secure_url?: string; error?: { message: string } };
      if (!upRes.ok || !upJson.secure_url) { setError(upJson.error?.message ?? 'Upload failed.'); return; }
      set('imageUrl', upJson.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const from = form.weightFrom ? Number(form.weightFrom) : undefined;
    const to = form.weightTo ? Number(form.weightTo) : undefined;
    // A single figure counts as an exact weight (min === max); if both are
    // given but entered backwards, swap rather than reject.
    let weightGramsMin = from ?? to;
    let weightGramsMax = to ?? from;
    if (from !== undefined && to !== undefined && to < from) {
      weightGramsMin = to;
      weightGramsMax = from;
    }

    setLoading(true);
    try {
      await apiPost('/api/branch-manager/custom-designs', {
        category: form.category,
        subCategory: form.subCategory.trim() || undefined,
        weightGramsMin,
        weightGramsMax,
        purity: form.purity || undefined,
        designNotes: form.notes.trim() || undefined,
        referenceImageUrl: form.imageUrl.trim() || undefined,
      });
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit'); } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="mt-4 font-display text-2xl font-medium">Request sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sent to Head Office for approval.</p>
        <Button className="mt-6 metal-sheen text-[#17120b] font-semibold" onClick={() => { setDone(false); setForm({ category: CATEGORIES[0], subCategory: '', weightFrom: '', weightTo: '', purity: '', notes: '', imageUrl: '' }); }}>New request</Button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(46rem_18rem_at_20%_-20%,rgba(201,168,76,0.14),transparent_65%)]" />

      {/* Intro */}
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#a0824a]">
          <PencilLine className="h-3.5 w-3.5" /> Custom design
        </p>
        <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">Begin with an idea</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Capture the design requirement and a reference image — the customer’s personal details stay outside the system.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.85fr] lg:gap-8">
        {/* Form */}
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-black/10 bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.category} onChange={(e) => { set('category', e.target.value); set('subCategory', ''); setSubCustom(false); }}>
                {CATEGORIES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sub-category <span className="font-normal">(optional)</span></label>
              {subOptions.length > 0 && !subCustom ? (
                <select className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.subCategory} onChange={(e) => { if (e.target.value === '__other__') { setSubCustom(true); set('subCategory', ''); } else set('subCategory', e.target.value); }}>
                  <option value="">—</option>
                  {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__other__">Other (type your own)…</option>
                </select>
              ) : (
                <div className="mt-1 flex gap-2">
                  <Input placeholder="Type a sub-category" value={form.subCategory} onChange={(e) => set('subCategory', e.target.value)} />
                  {subOptions.length > 0 && <button type="button" onClick={() => { setSubCustom(false); set('subCategory', ''); }} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">List</button>}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Weight range (g) <span className="font-normal">(optional)</span></label>
              <div className="mt-1 flex items-center gap-2">
                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="From" value={form.weightFrom} onChange={(e) => set('weightFrom', e.target.value)} className="h-10" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="To" value={form.weightTo} onChange={(e) => set('weightTo', e.target.value)} className="h-10" />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Leave &quot;To&quot; blank for an exact weight.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Purity</label>
              <select className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-white/60 px-3 text-sm" value={form.purity} onChange={(e) => set('purity', e.target.value)}>
                <option value="">—</option>
                {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Reference image — upload OR URL */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Reference image <span className="font-normal">(optional)</span></label>
              <div className="flex gap-1 text-xs">
                <button type="button" onClick={() => setImageMode('upload')} className={`rounded px-2 py-0.5 ${imageMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Upload</button>
                <button type="button" onClick={() => setImageMode('url')} className={`rounded px-2 py-0.5 ${imageMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>URL</button>
              </div>
            </div>
            {form.imageUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="reference" className="h-32 w-32 rounded-xl border object-cover" />
                <button type="button" onClick={() => set('imageUrl', '')} className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black" aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : imageMode === 'upload' ? (
              <>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
                  className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/15 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60 sm:w-48">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span className="text-xs">{uploading ? 'Uploading…' : 'Choose photo'}</span>
                </button>
                <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </>
            ) : (
              <Input placeholder="https://…" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Requirement / notes</label>
            <textarea className="mt-1 min-h-[130px] w-full rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm" placeholder="Describe the design the customer wants — style, size, engraving, timeline…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <Button type="submit" disabled={loading} className="metal-sheen h-11 w-full rounded-full text-sm font-semibold text-[#17120b]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-4 w-4" /> Send to Head Office</>}
          </Button>
        </form>

        {/* Helper panel */}
        <aside className="space-y-4 lg:pt-1">
          <div className="rounded-2xl border border-black/10 bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a0824a]">What happens next</p>
            <ol className="mt-4 space-y-3">
              {[
                'Your request goes to Head Office for approval.',
                'Head Office forwards a sanitized order to the manufacturer.',
                'Track status and message Head Office from My Orders.',
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
