'use client';

import { Loader2, Store as StoreIcon, Pencil, Key, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';

type Store = {
  id: string; name: string; slug: string; email: string | null;
  phone: string | null; ownerName: string | null; ownerPhone: string | null;
  city: string | null; addressStreet: string | null; addressCity: string | null; addressState: string | null;
  addressPincode: string | null; addressLandmark: string | null;
  isActive: boolean; registrationStatus: string; createdAt: Date;
  extraBranchAllowance: number; badgeLabel: string | null; branchCount: number; storeManagerCount: number;
  branches: Array<{
    id: string; name: string; addressCity: string | null; createdAt: Date;
    managerCount: number; hasRestockPin: boolean;
    managers: Array<{ id: string; name: string }>;
  }>;
};

const FREE_BRANCH_LIMIT = 2;

export default function ManufacturerStoresPage() {
  const { data, error, loading, reload } = useApi<Store[]>('/api/manufacturer/stores', '/manufacturer/login');
  const { data: badgeLabels, reload: reloadBadgeLabels } = useApi<string[]>('/api/manufacturer/retailer-badge-labels', '/manufacturer/login');
  const [editing, setEditing] = useState<Store | null>(null);
  const [pwStore, setPwStore] = useState<Store | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [badgeFilter, setBadgeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [storeCountFilter, setStoreCountFilter] = useState<'' | 'zero' | 'has'>('');

  const cityOptions = Array.from(new Set((data ?? []).map((s) => s.city).filter((c): c is string => !!c))).sort();

  const filtered = (data ?? []).filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (statusFilter === 'active' ? s.isActive : !s.isActive);
    const matchBadge = !badgeFilter || s.badgeLabel === badgeFilter;
    const matchCity = !cityFilter || s.city === cityFilter;
    const matchStoreCount = !storeCountFilter || (storeCountFilter === 'zero' ? s.branchCount === 0 : s.branchCount > 0);
    return matchSearch && matchStatus && matchBadge && matchCity && matchStoreCount;
  });

  const hasActiveFilters = !!(search || statusFilter || badgeFilter || cityFilter || storeCountFilter);
  function clearFilters() {
    setSearch(''); setStatusFilter(''); setBadgeFilter(''); setCityFilter(''); setStoreCountFilter('');
  }

  async function toggle(s: Store) {
    setActionError(null);
    try {
      await apiSend('PATCH', `/api/manufacturer/stores/${s.id}/active`, { isActive: !s.isActive });
      void reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update status');
    }
  }
  async function remove(s: Store) {
    if (!confirm(`Delete customer "${s.name}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await apiSend('DELETE', `/api/manufacturer/stores/${s.id}`);
      void reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Could not delete "${s.name}". Please try again.`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage approved customers.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {badgeLabels && badgeLabels.length > 0 && (
              <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm sm:w-auto" value={badgeFilter} onChange={(e) => setBadgeFilter(e.target.value)}>
                <option value="">All tags</option>
                {badgeLabels.map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            )}
            {cityOptions.length > 0 && (
              <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm sm:w-auto" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                <option value="">All cities</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm sm:w-auto" value={storeCountFilter} onChange={(e) => setStoreCountFilter(e.target.value as typeof storeCountFilter)}>
              <option value="">Any store count</option>
              <option value="has">Has stores</option>
              <option value="zero">No stores yet</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="self-start text-xs text-muted-foreground hover:text-foreground sm:self-auto">Clear</button>
          )}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <StoreIcon className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No stores yet. Approve registrations to add stores.</p>
        </div>
      )}
      {data && data.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <StoreIcon className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No customers match these filters.</p>
        </div>
      )}
      {filtered.length > 0 && (
        <>
          {/* Card list below md — a 6-column table forces horizontal scroll on
              phones even inside overflow-x-auto, which is unusable as a primary
              list. Table view (unchanged) takes over from md up. */}
          <div className="space-y-2 md:hidden">
            {filtered.map((s, index) => (
              <div key={s.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">#{index + 1}</p>
                    <p className="truncate text-sm font-medium">
                      {s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span>
                    </p>
                    {s.badgeLabel && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{s.badgeLabel}</span>}
                    <p className="mt-1 truncate text-xs text-muted-foreground">{s.email ?? s.ownerPhone ?? 'No email'}</p>
                    <p className="truncate text-xs text-muted-foreground">{[s.city, s.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => setEditing(s)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setPwStore(s)} className="text-muted-foreground hover:text-primary" aria-label={`Reset password for ${s.name}`}><Key className="h-4 w-4" /></button>
                    <button onClick={() => remove(s)} className="text-muted-foreground hover:text-red-600" aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title="Stores used / allowed (2 free + manufacturer-granted extra)">
                    Stores {s.branchCount}/{FREE_BRANCH_LIMIT}{s.extraBranchAllowance > 0 ? `+${s.extraBranchAllowance}` : ''}
                  </span>
                  <button onClick={() => toggle(s)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              {/* divide-x on every row draws the vertical column separators. */}
              <thead>
                <tr className="divide-x border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="whitespace-nowrap px-3 py-2.5">Sr No.</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Company Name</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Contact</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Stores</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s, index) => (
                  <tr key={s.id} className="divide-x hover:bg-muted/20">
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="min-w-[180px] px-3 py-3">
                      <p className="truncate text-sm font-medium">
                        {s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span>
                      </p>
                      {s.badgeLabel && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{s.badgeLabel}</span>}
                    </td>
                    <td className="min-w-[160px] px-3 py-3 text-xs text-muted-foreground">
                      <p className="truncate">{s.email ?? s.ownerPhone ?? 'No email'}</p>
                      <p className="truncate">{[s.city, s.phone].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title="Stores used / allowed (2 free + manufacturer-granted extra)">
                        {s.branchCount}/{FREE_BRANCH_LIMIT}{s.extraBranchAllowance > 0 ? `+${s.extraBranchAllowance}` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <button onClick={() => toggle(s)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditing(s)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setPwStore(s)} className="text-muted-foreground hover:text-primary" aria-label={`Reset password for ${s.name}`}><Key className="h-4 w-4" /></button>
                        <button onClick={() => remove(s)} className="text-muted-foreground hover:text-red-600" aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <EditModal
          store={editing}
          badgeLabels={badgeLabels ?? []}
          onBadgeLabelsChanged={() => void reloadBadgeLabels()}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      {pwStore && <PasswordModal store={pwStore} onClose={() => setPwStore(null)} />}
    </div>
  );
}

function EditModal({
  store, badgeLabels, onBadgeLabelsChanged, onClose, onSaved,
}: {
  store: Store; badgeLabels: string[]; onBadgeLabelsChanged: () => void; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: store.name, email: store.email ?? '', city: store.city ?? '', phone: store.phone ?? '',
    extraBranchAllowance: String(store.extraBranchAllowance),
  });
  const [badgeLabel, setBadgeLabel] = useState(store.badgeLabel ?? '');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addLabel() {
    const label = newLabel.trim();
    if (!label) return;
    setErr(null);
    try {
      await apiPost('/api/manufacturer/retailer-badge-labels', { label });
      setNewLabel('');
      onBadgeLabelsChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add tag');
    }
  }
  async function removeLabel(label: string) {
    if (!confirm(`Remove tag "${label}"? Any customer using it will become unassigned.`)) return;
    setErr(null);
    try {
      await apiSend('DELETE', `/api/manufacturer/retailer-badge-labels/${encodeURIComponent(label)}`);
      if (badgeLabel === label) setBadgeLabel('');
      onBadgeLabelsChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove tag');
    }
  }

  async function save() {
    setBusy(true); setErr(null);
    const extra = parseInt(form.extraBranchAllowance, 10);
    if (Number.isNaN(extra) || extra < 0) { setErr('Extra stores must be 0 or more.'); setBusy(false); return; }
    try {
      await apiSend('PATCH', `/api/manufacturer/stores/${store.id}`, { ...form, extraBranchAllowance: extra, badgeLabel: badgeLabel || null });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  const createdDate = new Date(store.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <Modal onClose={onClose} title={`${store.name} — Full Profile`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Editable contact section */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Info (Editable)</h3>
          <Input placeholder="Business Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Mobile Number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>

        {/* Read-only owner info */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Person Details (Read-only)</h3>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{store.ownerName || '—'}</span></p>
            <p><span className="text-muted-foreground">Mobile:</span> <span className="font-medium">{store.ownerPhone || '—'}</span></p>
          </div>
        </div>

        {/* Read-only full address */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headquarters Address (Read-only)</h3>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1 text-muted-foreground">
            <p>{store.addressStreet || '—'}</p>
            <p>{[store.addressCity, store.addressState, store.addressPincode].filter(Boolean).join(', ') || '—'}</p>
            <p>{store.addressLandmark || '—'}</p>
          </div>
        </div>

        {/* Read-only store/manager stats */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operations (Read-only)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-muted-foreground text-[11px]">Active Stores</p>
              <p className="text-lg font-semibold">{store.branchCount}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-muted-foreground text-[11px]">Store Managers</p>
              <p className="text-lg font-semibold">{store.storeManagerCount}</p>
            </div>
          </div>
        </div>

        {/* Read-only status info */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status (Read-only)</h3>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Status:</span> <span className="font-medium">{store.registrationStatus}</span></p>
            <p><span className="text-muted-foreground">Joined:</span> <span className="font-medium">{createdDate}</span></p>
          </div>
        </div>

        {/* Read-only stores list */}
        <div className="space-y-2 border-b pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stores (Read-only)</h3>
          {store.branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stores yet.</p>
          ) : (
            <div className="space-y-2">
              {store.branches.map((branch) => (
                <div key={branch.id} className="rounded-md border bg-muted/30 p-2.5 text-sm space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.addressCity || '—'}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{branch.managerCount} manager{branch.managerCount !== 1 ? 's' : ''}</p>
                      <p>{branch.hasRestockPin ? '🔒 PIN set' : 'No PIN'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editable store limits */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Extra stores granted (free limit is {FREE_BRANCH_LIMIT})
          </label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={form.extraBranchAllowance}
            onChange={(e) => setForm((f) => ({ ...f, extraBranchAllowance: e.target.value }))}
          />
          <p className="text-[11px] text-muted-foreground">
            Effective limit: {FREE_BRANCH_LIMIT} + {parseInt(form.extraBranchAllowance, 10) || 0} = {FREE_BRANCH_LIMIT + (parseInt(form.extraBranchAllowance, 10) || 0)} stores
          </p>
        </div>

        {/* Retailer badge */}
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tag</h3>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={badgeLabel}
            onChange={(e) => setBadgeLabel(e.target.value)}
          >
            <option value="">No tag</option>
            {badgeLabels.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {badgeLabels.map((label) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {label}
                <button type="button" onClick={() => removeLabel(label)} className="hover:text-red-600" aria-label={`Delete tag ${label}`}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New tag, e.g. Gold Customer" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <Button type="button" variant="outline" onClick={addLabel} disabled={!newLabel.trim()}>Add</Button>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2"><Button onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
      </div>
    </Modal>
  );
}

function PasswordModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (pw.length < 6) { setErr('Min 6 characters.'); return; }
    setBusy(true); setErr(null);
    try { await apiSend('PUT', `/api/manufacturer/stores/${store.id}/password`, { password: pw }); setDone(true); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  return (
    <Modal onClose={onClose} title={`Reset password — ${store.name}`}>
      {done ? <p className="text-sm text-green-700">Password reset.</p> : (
        <>
          <Input type="password" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2"><Button onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
        </>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
