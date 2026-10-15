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
type Tab = 'pending' | 'hold';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function StoreRegistrationsPage() {
  const { data, error, loading, reload } = useApi<Pending[]>('/api/manufacturer/store-registrations', '/manufacturer/login');
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  // The card whose inline "Hold reason" box is open, and its draft text.
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState('');

  const pending = data?.filter((s) => !s.registrationOnHoldAt) ?? [];
  const onHold = data?.filter((s) => s.registrationOnHoldAt) ?? [];
  const rows = tab === 'pending' ? pending : onHold;

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customer Registrations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Approve customers to give them access and link them to your catalog. Not sure yet? Put it on hold and decide later.</p>
      </div>

      <div role="tablist" className="inline-flex rounded-full border bg-card p-1 text-sm">
        {([['pending', 'Pending', pending.length], ['hold', 'On Hold', onHold.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${tab === key ? 'metal-sheen text-[#17120b]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label}
            <span className={`rounded-full px-1.5 text-[11px] font-semibold ${tab === key ? 'bg-white/60' : 'bg-muted'}`}>{data ? count : '–'}</span>
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {data && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          {tab === 'pending'
            ? <><ClipboardCheck className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No pending registrations.</p></>
            : <><PauseCircle className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No registrations on hold.</p></>}
        </div>
      )}
      {data && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((s) => {
            const held = Boolean(s.registrationOnHoldAt);
            const disabled = busy?.startsWith(s.id);
            return (
              <div key={s.id} className={`rounded-xl border bg-card p-4 space-y-2 ${held ? 'border-amber-200' : ''}`}>
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
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p className="font-medium">On hold since {formatDate(s.registrationOnHoldAt!)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">{s.registrationHoldNote ? `Reason: ${s.registrationHoldNote}` : 'No reason given.'}</p>
                  </div>
                ) : null}

                {holdingId === s.id ? (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <label htmlFor={`hold-${s.id}`} className="block text-xs font-medium text-amber-900">Reason for hold <span className="font-normal text-amber-800/70">(Optional)</span></label>
                    <textarea
                      id={`hold-${s.id}`}
                      autoFocus
                      rows={2}
                      maxLength={500}
                      value={holdNote}
                      onChange={(e) => setHoldNote(e.target.value)}
                      placeholder="e.g. Call owner to verify GST details"
                      className="w-full resize-y rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={disabled} onClick={() => act(s.id, 'hold', { note: holdNote.trim() || undefined })} className="bg-amber-500 font-semibold text-white hover:bg-amber-600">
                        {busy === s.id + 'hold' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><PauseCircle className="mr-1 h-3.5 w-3.5" />Confirm hold</>}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => { setHoldingId(null); setHoldNote(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" disabled={disabled} onClick={() => act(s.id, 'approve')} className="metal-sheen text-[#17120b] font-semibold">
                      {busy === s.id + 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</>}
                    </Button>
                    {held ? (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => act(s.id, 'unhold')} className="border-amber-300 text-amber-800 hover:bg-amber-50">
                        {busy === s.id + 'unhold' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Undo2 className="mr-1 h-3.5 w-3.5" />Move to Pending</>}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setHoldingId(s.id); setHoldNote(''); }} className="border-amber-300 text-amber-800 hover:bg-amber-50">
                        <PauseCircle className="mr-1 h-3.5 w-3.5" />Hold
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => act(s.id, 'reject')} className="border-red-200 text-red-700 hover:bg-red-50">
                      <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
