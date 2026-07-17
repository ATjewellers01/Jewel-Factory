'use client';

import { Loader2, Plus, Trash2, Store, ChevronDown, ChevronUp, KeyRound, ShieldCheck, ShieldOff, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';

type Branch = {
  id: string; name: string; isActive: boolean;
  addressStreet: string | null; addressCity: string | null; addressState: string | null;
  addressPincode: string | null; addressLandmark: string | null; phone: string | null;
  restockPinHash: string | null;
  _count?: { managers: number };
};

const emptyBranch = { name: '', addressStreet: '', addressCity: '', addressState: '', addressPincode: '', addressLandmark: '', phone: '' };

export default function BranchesPage() {
  const { data, error, loading, reload } = useApi<Branch[]>('/api/store/branches', '/store/login');
  const [form, setForm] = useState(emptyBranch);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null); setAdding(true);
    try {
      await apiPost('/api/store/branches', form);
      setForm(emptyBranch);
      void reload();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to add store'); } finally { setAdding(false); }
  }

  async function toggle(b: Branch) {
    await apiSend('PATCH', `/api/store/branches/${b.id}`, { isActive: !b.isActive });
    void reload();
  }
  async function remove(b: Branch) {
    if (!confirm(`Delete "${b.name}"? This removes its store managers too.`)) return;
    await apiSend('DELETE', `/api/store/branches/${b.id}`);
    void reload();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Stores (Branches)</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Each store has its own address, store managers, and restock PIN.</p>
      </div>

      <form onSubmit={add} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a Store</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Store name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input type="tel" placeholder="Store phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input placeholder="Street / area" value={form.addressStreet} onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))} />
          <Input placeholder="City" value={form.addressCity} onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))} />
          <Input placeholder="State" value={form.addressState} onChange={(e) => setForm((f) => ({ ...f, addressState: e.target.value }))} />
          <Input placeholder="Pincode" value={form.addressPincode} onChange={(e) => setForm((f) => ({ ...f, addressPincode: e.target.value }))} />
        </div>
        <Input placeholder="Landmark (optional)" value={form.addressLandmark} onChange={(e) => setForm((f) => ({ ...f, addressLandmark: e.target.value }))} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <Button type="submit" disabled={adding} className="metal-sheen text-[#17120b] font-semibold">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" />Add store</>}
        </Button>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <Store className="h-8 w-8 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No stores yet. Add your first store above.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((b) => (
            <div key={b.id} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button onClick={() => setOpen(open === b.id ? null : b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {open === b.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[b.addressCity, b.addressState].filter(Boolean).join(', ') || 'No address'} · {b._count?.managers ?? 0} manager(s)
                      {b.restockPinHash ? ' · PIN set' : ''}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(b)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{b.isActive ? 'Active' : 'Inactive'}</button>
                  <button onClick={() => remove(b)} title="Delete store" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {open === b.id && <BranchDetail branch={b} onChange={reload} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchDetail({ branch, onChange }: { branch: Branch; onChange: () => void }) {
  return (
    <div className="space-y-5 border-t bg-muted/10 px-4 py-4">
      <RestockPin branch={branch} onChange={onChange} />
      <BranchManagers branchId={branch.id} />
    </div>
  );
}

function RestockPin({ branch, onChange }: { branch: Branch; onChange: () => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (pin.length < 4) { setMsg('PIN must be at least 4 digits.'); return; }
    setBusy(true); setMsg(null);
    try { await apiSend('PUT', `/api/store/branches/${branch.id}/restock-pin`, { pin }); setPin(''); setMsg('Restock PIN set.'); onChange(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setMsg(null);
    try { await apiSend('DELETE', `/api/store/branches/${branch.id}/restock-pin`); setMsg('Restock PIN removed.'); onChange(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />Restock PIN {branch.restockPinHash && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">set</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="password" inputMode="numeric" placeholder="New PIN (4–12)" value={pin} onChange={(e) => setPin(e.target.value)} className="max-w-[160px]" />
        <Button size="sm" onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><KeyRound className="mr-1 h-3.5 w-3.5" />Set</>}</Button>
        {branch.restockPinHash && <Button size="sm" variant="outline" onClick={clear} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50"><ShieldOff className="mr-1 h-3.5 w-3.5" />Remove</Button>}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

type BM = { id: string; name: string; email: string; phone: string | null; isActive: boolean };

function BranchManagers({ branchId }: { branchId: string }) {
  const { data, loading, reload } = useApi<BM[]>(`/api/store/branches/${branchId}/managers`);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pwMgr, setPwMgr] = useState<BM | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setAdding(true);
    try { await apiPost(`/api/store/branches/${branchId}/managers`, form); setForm({ name: '', email: '', password: '', phone: '' }); void reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setAdding(false); }
  }
  async function remove(m: BM) { if (!confirm('Remove this store manager?')) return; await apiSend('DELETE', `/api/store/branches/${branchId}/managers/${m.id}`); void reload(); }
  async function toggle(m: BM) { await apiSend('PATCH', `/api/store/branches/${branchId}/managers/${m.id}`, { isActive: !m.isActive }); void reload(); }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" />Store Managers</p>

      {loading && <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
      {data && data.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {data.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(m)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{m.isActive ? 'Active' : 'Inactive'}</button>
                <button onClick={() => setPwMgr(m)} title="Reset password" className="text-muted-foreground hover:text-primary"><KeyRound className="h-4 w-4" /></button>
                <button onClick={() => remove(m)} title="Remove" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2">
        <Input placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <Input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <Input type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <Input type="password" placeholder="Password (min 6) *" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={adding} className="metal-sheen text-[#17120b] font-semibold">{adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="mr-1 h-3.5 w-3.5" />Add store manager</>}</Button>
        </div>
      </form>

      {pwMgr && <PwModal branchId={branchId} mgr={pwMgr} onClose={() => setPwMgr(null)} />}
    </div>
  );
}

function PwModal({ branchId, mgr, onClose }: { branchId: string; mgr: BM; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (pw.length < 6) { setErr('Min 6 characters.'); return; }
    setBusy(true); setErr(null);
    try { await apiSend('PUT', `/api/store/branches/${branchId}/managers/${mgr.id}/password`, { password: pw }); setDone(true); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">Reset password — {mgr.name}</h3>
        {done ? (<><p className="text-sm text-green-700">Password reset.</p><Button onClick={onClose} className="w-full">Done</Button></>) : (
          <><Input type="password" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2"><Button onClick={save} disabled={busy} className="metal-sheen flex-1 text-[#17120b] font-semibold">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset'}</Button><Button onClick={onClose} variant="outline">Cancel</Button></div></>
        )}
      </div>
    </div>
  );
}
