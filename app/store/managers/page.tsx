'use client';

import { Loader2, Plus, Trash2, UserCog, KeyRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi, apiPost, apiSend } from '@/hooks/use-api';

type Manager = { id: string; name: string; email: string; phone: string | null; isActive: boolean };

export default function ManagersPage() {
  const { data, error, loading, reload } = useApi<Manager[]>('/api/store/managers', '/store/login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pwManager, setPwManager] = useState<Manager | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null); setAdding(true);
    try {
      await apiPost('/api/store/managers', form);
      setForm({ name: '', email: '', password: '', phone: '' });
      void reload();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Failed to add manager'); } finally { setAdding(false); }
  }

  async function remove(id: string) {
    if (!confirm('Remove this manager?')) return;
    await apiSend('DELETE', `/api/store/managers/${id}`);
    void reload();
  }

  async function toggle(m: Manager) {
    await apiSend('PATCH', `/api/store/managers/${m.id}`, { isActive: !m.isActive });
    void reload();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Managers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Managers can approve orders and custom design requests.</p>
      </div>

      <form onSubmit={add} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Manager</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <Input type="password" placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <Button type="submit" disabled={adding} className="metal-sheen text-[#17120b] font-semibold">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" />Add manager</>}
        </Button>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <UserCog className="h-8 w-8 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No managers yet.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {data.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(m)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {m.isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => setPwManager(m)} title="Reset password" className="text-muted-foreground hover:text-primary"><KeyRound className="h-4 w-4" /></button>
                <button onClick={() => remove(m.id)} title="Remove" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pwManager && <ResetPasswordModal manager={pwManager} onClose={() => setPwManager(null)} />}
    </div>
  );
}

function ResetPasswordModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      await apiSend('PUT', `/api/store/managers/${manager.id}/password`, { password: pw });
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not reset password.'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">Reset password — {manager.name}</h3>
        {done ? (
          <>
            <p className="text-sm text-green-700">Password reset. Share the new password with {manager.name}.</p>
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        ) : (
          <>
            <Input type="password" placeholder="New password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy} className="metal-sheen flex-1 text-[#17120b] font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
              </Button>
              <Button onClick={onClose} variant="outline">Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
