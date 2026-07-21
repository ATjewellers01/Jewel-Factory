'use client';

import { CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/hooks/use-api';
import { CatalogOrderPanel } from '../CatalogOrderPanel';

export default function StoreManagerRestockPage() {
  const [gate, setGate] = useState<'checking' | 'locked' | 'open'>('checking');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  async function check() {
    try {
      const res = await fetch('/api/branch-manager/restock/lock-status', { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) { window.location.assign('/store-manager/login'); return; }
      const json = (await res.json()) as { data?: { requiresPin: boolean; unlocked: boolean } };
      if (json.data && (!json.data.requiresPin || json.data.unlocked)) setGate('open');
      else setGate('locked');
    } catch { setGate('locked'); }
  }
  useEffect(() => { void check(); }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setUnlocking(true);
    try {
      await apiPost('/api/branch-manager/restock/unlock', { pin });
      setGate('open');
    } catch { setPinError('Incorrect PIN.'); } finally { setUnlocking(false); }
  }

  if (gate === 'checking') return <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  if (gate === 'locked') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <form onSubmit={unlock} className="w-full max-w-xs space-y-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Lock className="h-6 w-6" /></div>
          <div>
            <h1 className="font-display text-xl font-medium">Restock is protected</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the restock PIN. This keeps customers out of restock.</p>
          </div>
          <Input type="password" inputMode="numeric" autoFocus placeholder="Restock PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="text-center tracking-widest" />
          {pinError && <p className="text-sm text-red-600">{pinError}</p>}
          <Button type="submit" disabled={unlocking} className="metal-sheen w-full text-[#17120b] font-semibold">
            {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="mr-1.5 h-4 w-4" />Unlock</>}
          </Button>
        </form>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="mt-4 font-display text-2xl font-medium">Restock sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">Order <span className="font-mono">{placed}</span> sent to Head Office for approval.</p>
        <Button className="mt-6 metal-sheen text-[#17120b] font-semibold" onClick={() => setPlaced(null)}>New restock</Button>
      </div>
    );
  }

  return (
    <CatalogOrderPanel
      title="Restock"
      subtitle="Order stock for this store from the manufacturer catalog. Goes to Head Office for approval."
      placeEndpoint="/api/branch-manager/restock-orders"
      notePlaceholder="Any note for Head Office (optional)…"
      onPlaced={(o) => setPlaced(o.orderNumber ?? 'placed')}
      showPopularity
    />
  );
}
