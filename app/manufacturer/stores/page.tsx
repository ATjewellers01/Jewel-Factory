'use client';

import { Loader2, Store as StoreIcon, Pencil, Key, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiSend } from '@/hooks/use-api';

type Store = { id: string; name: string; slug: string; email: string; city: string | null; phone: string | null; isActive: boolean; registrationStatus: string };

export default function ManufacturerStoresPage() {
  const { data, error, loading, reload } = useApi<Store[]>('/api/manufacturer/stores', '/manufacturer/login');
  const [editing, setEditing] = useState<Store | null>(null);
  const [pwStore, setPwStore] = useState<Store | null>(null);

  async function toggle(s: Store) {
    await apiSend('PATCH', `/api/manufacturer/stores/${s.id}/active`, { isActive: !s.isActive });
    void reload();
  }
  async function remove(s: Store) {
    if (!confirm(`Delete retailer "${s.name}"? This cannot be undone.`)) return;
    await apiSend('DELETE', `/api/manufacturer/stores/${s.id}`);
    void reload();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Retailers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage approved retailers.</p>
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
                <p className="truncate text-sm font-medium">{s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span></p>
                <p className="truncate text-xs text-muted-foreground">{s.email}{s.city ? ` · ${s.city}` : ''}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
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

      {editing && <EditModal store={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
      {pwStore && <PasswordModal store={pwStore} onClose={() => setPwStore(null)} />}
    </div>
  );
}

function EditModal({ store, onClose, onSaved }: { store: Store; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: store.name, email: store.email, city: store.city ?? '', phone: store.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    try { await apiSend('PATCH', `/api/manufacturer/stores/${store.id}`, form); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  }
  return (
    <Modal onClose={onClose} title="Edit store">
      <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <Input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      <Input placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
      <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2"><Button onClick={save} disabled={busy} className="metal-sheen text-[#17120b] font-semibold flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
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
