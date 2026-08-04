'use client';

import { Loader2, Plus, Trash2, Store, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';
import { fieldError, toFieldErrors } from '@/lib/field-error';

type Branch = {
  id: string; name: string; isActive: boolean;
  addressStreet: string | null; addressCity: string | null; addressState: string | null;
  addressPincode: string | null; addressLandmark: string | null; phone: string | null;
  restockPinHash: string | null;
  _count?: { managers: number };
};

type BM = { id: string; name: string | null; email: string | null; phone: string | null; isActive: boolean };

const emptyForm = { name: '', phone: '', email: '', pin: '' };
const labelClass = 'grid gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

/**
 * One form creates the Store, its first Retailer User, and the branch restock
 * PIN together. There is no address input — a store is identified by name only.
 *
 * The three writes are separate API calls because they hit different resources
 * (branch / branch manager / restock PIN). The branch is created first since the
 * other two need its id; if a later step fails the branch still exists, so the
 * error message says exactly which part to retry from the expanded row.
 */
export default function BranchesPage() {
  const { data, error, loading, reload } = useApi<Branch[]>('/api/store/branches', '/store/login');
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<unknown>(null);
  const [open, setOpen] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitErr(null);

    if (!form.name.trim()) return setFormError('Store name is required.');
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) return setFormError('Enter a valid 10-digit Retail User number.');
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setFormError('Enter a valid Retail User email.');
    if (form.pin.trim() && (form.pin.trim().length < 4 || form.pin.trim().length > 12)) {
      return setFormError('Restock PIN must be 4–12 digits.');
    }

    setAdding(true);
    try {
      const branch = (await apiPost('/api/store/branches', { name: form.name.trim() })) as { id: string };
      if (!branch?.id) throw new Error('Store was created but no id came back.');

      try {
        await apiPost(`/api/store/branches/${branch.id}/managers`, {
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
        });
      } catch (err) {
        setFormError(`Store created, but the Retailer User failed: ${err instanceof Error ? err.message : 'unknown error'}. Add them from the store below.`);
        setSubmitErr(err);
        void reload();
        return;
      }

      if (form.pin.trim()) {
        try {
          await apiSend('PUT', `/api/store/branches/${branch.id}/restock-pin`, { pin: form.pin.trim() });
        } catch (err) {
          setFormError(`Store and Retailer User created, but the Restock PIN failed: ${err instanceof Error ? err.message : 'unknown error'}. Set it from the store below.`);
          setSubmitErr(err);
          void reload();
          return;
        }
      }

      setForm(emptyForm);
      void reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add store');
      setSubmitErr(err);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(b: Branch) {
    await apiSend('PATCH', `/api/store/branches/${b.id}`, { isActive: !b.isActive });
    void reload();
  }
  async function remove(b: Branch) {
    if (!confirm(`Delete "${b.name}"? This removes its Retailer Users too.`)) return;
    await apiSend('DELETE', `/api/store/branches/${b.id}`);
    void reload();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Stores (Branches)</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Each store has its own Retailer Users and restock PIN.</p>
      </div>

      <form onSubmit={add} className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a Retailer User</h2>

        <label className={labelClass}>Store Name *
          <Input placeholder="e.g. Kanpur Main" value={form.name} onChange={set('name')} required />
          <FieldError errors={toFieldErrors(fieldError(submitErr, 'name'))} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>User Mobile Number *
            <Input type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')} required autoComplete="off" />
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'phone'))} />
          </label>
          <label className={labelClass}>Retail User Email
            <Input type="email" inputMode="email" placeholder="e.g. name@example.com" value={form.email} onChange={set('email')} autoComplete="off" />
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'email'))} />
          </label>
        </div>

        <label className={labelClass}>Restock Pin
          <Input type="password" inputMode="numeric" maxLength={12} placeholder="4–12 digits (optional)" value={form.pin} onChange={set('pin')} className="sm:max-w-[220px]" autoComplete="new-password" />
          <FieldError errors={toFieldErrors(fieldError(submitErr, 'pin'))} />
        </label>

        {/* No password field: the mobile number is both the Retailer User's login
            password and, when no email is given, their username. */}
        <p className="text-xs leading-5 text-muted-foreground">
          No password to set — the Retailer User signs in with their mobile number as the password
          {form.email.trim() ? ' and the email above as the username.' : ', which is also their username.'}
        </p>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <Button type="submit" disabled={adding} className="metal-sheen text-[#17120b] font-semibold">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" />Add Retailer User</>}
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
                      {b._count?.managers ?? 0} Retailer User(s){b.restockPinHash ? ' · PIN set' : ''}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(b)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{b.isActive ? 'Active' : 'Inactive'}</button>
                  <button onClick={() => remove(b)} title="Delete store" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {open === b.id && <BranchRetailerUsers branch={b} onChange={reload} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Expanded row: the store's existing Retailer Users, plus a compact add form for
 * additional users on a store that already exists (the top form covers the
 * store + first user case).
 */
function BranchRetailerUsers({ branch, onChange }: { branch: Branch; onChange: () => void }) {
  const branchId = branch.id;
  const { data, loading, reload } = useApi<BM[]>(`/api/store/branches/${branchId}/managers`);
  const [form, setForm] = useState({ phone: '', email: '' });
  const [pin, setPin] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<unknown>(null);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSubmitErr(null); setAdding(true);
    try {
      await apiPost(`/api/store/branches/${branchId}/managers`, { phone: form.phone.trim(), email: form.email.trim() || undefined });
      setForm({ phone: '', email: '' });
      void reload();
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setSubmitErr(e); } finally { setAdding(false); }
  }
  async function remove(m: BM) {
    if (!confirm('Remove this Retailer User?')) return;
    await apiSend('DELETE', `/api/store/branches/${branchId}/managers/${m.id}`);
    void reload(); onChange();
  }
  async function toggle(m: BM) {
    await apiSend('PATCH', `/api/store/branches/${branchId}/managers/${m.id}`, { isActive: !m.isActive });
    void reload();
  }

  async function savePin() {
    if (pin.trim().length < 4) { setPinMsg('PIN must be at least 4 digits.'); return; }
    setPinBusy(true); setPinMsg(null);
    try { await apiSend('PUT', `/api/store/branches/${branchId}/restock-pin`, { pin: pin.trim() }); setPin(''); setPinMsg('Restock PIN set.'); onChange(); }
    catch (e) { setPinMsg(e instanceof Error ? e.message : 'Failed'); } finally { setPinBusy(false); }
  }
  async function clearPin() {
    setPinBusy(true); setPinMsg(null);
    try { await apiSend('DELETE', `/api/store/branches/${branchId}/restock-pin`); setPinMsg('Restock PIN removed.'); onChange(); }
    catch (e) { setPinMsg(e instanceof Error ? e.message : 'Failed'); } finally { setPinBusy(false); }
  }

  return (
    <div className="space-y-3 border-t bg-muted/10 px-4 py-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-3.5 w-3.5" />Retailer Users</p>

      {loading && <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
      {data && data.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {data.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.email ?? m.phone}</p>
                {m.email && m.phone && <p className="truncate text-xs text-muted-foreground">{m.phone}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(m)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{m.isActive ? 'Active' : 'Inactive'}</button>
                <button onClick={() => remove(m)} title="Remove" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* One Retailer User per Store — a store already carrying one doesn't
          get a second add-form; remove the existing one first. */}
      {(data?.length ?? 0) === 0 && (
        <form onSubmit={add} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2">
          <div>
            <Input type="tel" inputMode="numeric" maxLength={10} placeholder="User Mobile Number *" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required autoComplete="off" />
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'phone'))} />
          </div>
          <div>
            <Input type="email" placeholder="Retail User Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" />
            <FieldError errors={toFieldErrors(fieldError(submitErr, 'email'))} />
          </div>
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={adding} className="metal-sheen text-[#17120b] font-semibold">{adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="mr-1 h-3.5 w-3.5" />Add Retailer User</>}</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Restock Pin {branch.restockPinHash && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-normal normal-case tracking-normal text-amber-800">set</span>}
        </span>
        <Input type="password" inputMode="numeric" maxLength={12} placeholder="4–12 digits" value={pin} onChange={(e) => setPin(e.target.value)} className="max-w-[150px]" />
        <Button type="button" size="sm" variant="outline" disabled={pinBusy} onClick={savePin}>Set PIN</Button>
        {branch.restockPinHash && <Button type="button" size="sm" variant="outline" onClick={clearPin} disabled={pinBusy} className="border-red-200 text-red-600 hover:bg-red-50">Remove</Button>}
        {pinMsg && <p className="w-full text-xs text-muted-foreground">{pinMsg}</p>}
      </div>
    </div>
  );
}
