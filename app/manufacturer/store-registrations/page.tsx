'use client';

import { Loader2, ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';

type Pending = {
  id: string; name: string; slug: string; email: string | null; city: string | null;
  ownerName: string | null; ownerPhone: string | null;
  addressStreet: string | null; addressCity: string | null; addressState: string | null; addressPincode: string | null;
  registrationSubmittedAt: string | null;
};

export default function StoreRegistrationsPage() {
  const { data, error, loading, reload } = useApi<Pending[]>('/api/manufacturer/store-registrations', '/manufacturer/login');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('Reject this store registration?')) return;
    setBusy(id + action);
    try { await apiPost(`/api/manufacturer/store-registrations/${id}/${action}`); void reload(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customer Registrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Approve customers to give them access and link them to your catalog.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No pending registrations.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span></p>
                  <p className="text-xs text-muted-foreground">{s.email ?? s.ownerPhone ?? 'No email'}{s.city ? ` · ${s.city}` : ''}</p>
                </div>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">Pending</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Owner: {s.ownerName ?? '—'} {s.ownerPhone ? `(${s.ownerPhone})` : ''}</p>
                <p>Address: {[s.addressStreet, s.addressCity, s.addressState, s.addressPincode].filter(Boolean).join(', ') || '—'}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'approve')} className="metal-sheen text-[#17120b] font-semibold">
                  {busy === s.id + 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</>}
                </Button>
                <Button size="sm" variant="outline" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'reject')} className="border-red-200 text-red-700 hover:bg-red-50">
                  <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
