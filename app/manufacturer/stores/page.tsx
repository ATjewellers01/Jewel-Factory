'use client';

import { Loader2, Store as StoreIcon, Pencil, Key, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';

type Store = {
  id: string; name: string; slug: string; email: string;
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

  async function toggle(s: Store) {
    await apiSend('PATCH', `/api/manufacturer/stores/${s.id}/active`, { isActive: !s.isActive });
    void reload();
  }
  async function remove(s: Store) {
    if (!confirm(`Delete purchase manager "${s.name}"? This cannot be undone.`)) return;
    await apiSend('DELETE', `/api/manufacturer/stores/${s.id}`);
    void reload();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Purchase managers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage approved purchase managers.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <StoreIcon className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No stores yet. Approve registrations to add stores.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span>
                  {s.badgeLabel && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{s.badgeLabel}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s.email}{s.city ? ` · ${s.city}` : ''}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title="Stores used / allowed (2 free + manufacturer-granted extra)">
                  Stores {s.branchCount}/{FREE_BRANCH_LIMIT}{s.extraBranchAllowance > 0 ? `+${s.extraBranchAllowance}` : ''}
                </span>
                <button onClick={() => toggle(s)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => setEditing(s)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setPwStore(s)} className="text-muted-foreground hover:text-primary"><Key className="h-4 w-4" /></button>
                <button onClick={() => remove(s)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
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
    name: store.name, email: store.email, city: store.city ?? '', phone: store.phone ?? '',
    extraBranchAllowance: String(store.extraBranchAllowance),
  });
  const [badgeLabel, setBadgeLabel] = useState(store.badgeLabel ?? '');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addLabel() {
    const label = newLabel.trim();
    if (!label) return;
    await apiPost('/api/manufacturer/retailer-badge-labels', { label });
    setNewLabel('');
    onBadgeLabelsChanged();
  }
  async function removeLabel(label: string) {
    if (!confirm(`Remove badge "${label}"? Any purchase manager using it will become unassigned.`)) return;
    await apiSend('DELETE', `/api/manufacturer/retailer-badge-labels/${encodeURIComponent(label)}`);
    if (badgeLabel === label) setBadgeLabel('');
    onBadgeLabelsChanged();
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Badge</h3>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={badgeLabel}
            onChange={(e) => setBadgeLabel(e.target.value)}
          >
            <option value="">No badge</option>
            {badgeLabels.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {badgeLabels.map((label) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {label}
                <button type="button" onClick={() => removeLabel(label)} className="hover:text-red-600" aria-label={`Delete badge ${label}`}>×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New badge, e.g. Gold Customer" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
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
