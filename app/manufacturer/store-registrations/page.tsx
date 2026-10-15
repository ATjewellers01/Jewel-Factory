'use client';

import { Loader2, ClipboardCheck, CheckCircle2, XCircle, PauseCircle, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApi, apiPost } from '@/hooks/use-api';

type Pending = {
  id: string; name: string; slug: string; email: string | null; city: string | null;
  ownerName: string | null; ownerPhone: string | null;
  addressStreet: string | null; addressCity: string | null; addressState: string | null; addressPincode: string | null;
  registrationSubmittedAt: string | null;
  // Set when the manufacturer parked it on the "On Hold" list (status is still PENDING).
  registrationOnHoldAt: string | null;
  registrationHoldNote: string | null;
};

type Action = 'approve' | 'reject' | 'hold' | 'unhold';

export default function StoreRegistrationsPage() {
  const { data, error, loading, reload } = useApi<Pending[]>('/api/manufacturer/store-registrations', '/manufacturer/login');
  const [busy, setBusy] = useState<string | null>(null);
  // The card whose inline "Hold reason" box is open, and its draft text.
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState('');

  const pending = data?.filter((s) => !s.registrationOnHoldAt) ?? [];
  const onHold = data?.filter((s) => s.registrationOnHoldAt) ?? [];

  async function act(id: string, action: Action, body?: unknown) {
    if (action === 'reject' && !confirm('Reject this store registration?')) return;
    setBusy(id + action);
    try {
      await apiPost(`/api/manufacturer/store-registrations/${id}/${action}`, body);
      if (action === 'hold') { setHoldingId(null); setHoldNote(''); }
      void reload();
    }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); }
  }

  function card(s: Pending) {
    const held = Boolean(s.registrationOnHoldAt);
    return (
      <div key={s.id} className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{s.name} <span className="text-xs font-normal text-muted-foreground">/{s.slug}</span></p>
            <p className="text-xs text-muted-foreground">{s.email ?? s.ownerPhone ?? 'No email'}{s.city ? ` · ${s.city}` : ''}</p>
          </div>
          {held
            ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">On Hold</span>
            : <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">Pending</span>}
        </div>
        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Owner: {s.ownerName ?? '—'} {s.ownerPhone ? `(${s.ownerPhone})` : ''}</p>
          <p>Address: {[s.addressStreet, s.addressCity, s.addressState, s.addressPincode].filter(Boolean).join(', ') || '—'}</p>
        </div>
        {held ? (
          <p className="text-xs text-amber-800">
            On hold since {new Date(s.registrationOnHoldAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {s.registrationHoldNote ? ` · ${s.registrationHoldNote}` : ''}
          </p>
        ) : null}

        {holdingId === s.id ? (
          <div className="space-y-2 pt-1">
            <textarea
              autoFocus
              rows={2}
              maxLength={500}
              value={holdNote}
              onChange={(e) => setHoldNote(e.target.value)}
              placeholder="Reason for hold (optional)"
              aria-label="Reason for hold (optional)"
              className="w-full resize-y rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'hold', { note: holdNote.trim() || undefined })} className="border-amber-300 text-amber-800 hover:bg-amber-50">
                {busy === s.id + 'hold' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><PauseCircle className="mr-1 h-3.5 w-3.5" />Confirm hold</>}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy?.startsWith(s.id)} onClick={() => { setHoldingId(null); setHoldNote(''); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'approve')} className="metal-sheen text-[#17120b] font-semibold">
              {busy === s.id + 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</>}
            </Button>
            {held ? (
              <Button size="sm" variant="outline" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'unhold')} className="border-amber-300 text-amber-800 hover:bg-amber-50">
                {busy === s.id + 'unhold' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Undo2 className="mr-1 h-3.5 w-3.5" />Move to Pending</>}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy?.startsWith(s.id)} onClick={() => { setHoldingId(s.id); setHoldNote(''); }} className="border-amber-300 text-amber-800 hover:bg-amber-50">
                <PauseCircle className="mr-1 h-3.5 w-3.5" />Hold
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={busy?.startsWith(s.id)} onClick={() => act(s.id, 'reject')} className="border-red-200 text-red-700 hover:bg-red-50">
              <XCircle className="mr-1 h-3.5 w-3.5" />Reject
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customer Registrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Approve customers to give them access and link them to your catalog.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && pending.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No pending registrations.</p>
        </div>
      )}
      {data && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map(card)}
        </div>
      )}

      {/* Extra: registrations the manufacturer parked to decide later. Only shown when there are any. */}
      {data && onHold.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <PauseCircle className="h-4 w-4 text-amber-700" />On Hold
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{onHold.length}</span>
          </h2>
          {onHold.map(card)}
        </div>
      )}
    </div>
  );
}
