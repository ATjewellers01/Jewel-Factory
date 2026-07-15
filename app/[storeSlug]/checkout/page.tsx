'use client';

import { CheckCircle2, Loader2, MapPin, Minus, Plus, ShoppingBag, Store, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKioskStore } from '@/components/kiosk/StoreContext';
import { useGuestCart } from '@/hooks/use-guest-cart';

export default function KioskCheckoutPage() {
  const store = useKioskStore();
  const cart = useGuestCart();
  const router = useRouter();
  const base = `/${store.slug}`;

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Please enter your name.');
    if (form.phone.trim().length < 7) return setError('Please enter a valid phone number.');
    if (mode === 'delivery' && !form.address.trim()) return setError('Please enter a delivery address.');

    setLoading(true);
    try {
      const res = await fetch('/api/kiosk/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: store.slug,
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          customerEmail: form.email.trim() || undefined,
          pickupStore: mode === 'pickup',
          deliveryAddress: mode === 'delivery' ? form.address.trim() : undefined,
          notes: form.notes.trim() || undefined,
          items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const json = (await res.json()) as { data?: { id: string; orderNumber: string }; error?: { message: string } };
      if (!res.ok || !json.data) { setError(json.error?.message ?? 'Could not place order.'); return; }
      cart.clear();
      router.push(`${base}/checkout/success?order=${json.data.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally { setLoading(false); }
  }

  if (!mounted) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">Your bag is empty.</p>
        <Link href={`${base}/catalog`}><Button variant="outline" className="mt-4">Browse Catalog</Button></Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-medium tracking-tight">Complete Your Order</h1>
      <p className="mt-1 text-sm text-muted-foreground">No account needed — just your contact details.</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* Cart */}
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Your selection ({cart.count} item{cart.count !== 1 ? 's' : ''})</span>
          </div>
          <div className="divide-y">
            {cart.items.map((i) => (
              <div key={i.productId} className="flex items-center gap-3 px-4 py-3">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt={i.name} className="h-12 w-12 flex-shrink-0 rounded-lg border object-cover" />
                ) : <div className="h-12 w-12 flex-shrink-0 rounded-lg border bg-muted" />}
                <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium">{i.name}</p></div>
                {/* Quantity stepper */}
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button type="button" onClick={() => cart.setQty(i.productId, i.quantity - 1)} disabled={i.quantity <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Decrease">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-medium tabular-nums">{i.quantity}</span>
                  <button type="button" onClick={() => cart.setQty(i.productId, i.quantity + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted" aria-label="Increase">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" onClick={() => cart.remove(i.productId)} className="flex-shrink-0 text-muted-foreground hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </section>

        {/* Details */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="text-xs font-medium text-muted-foreground">Name *</label><Input className="mt-1" value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Phone *</label><Input className="mt-1" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required /></div>
          <div className="sm:col-span-2"><label className="text-xs font-medium text-muted-foreground">Email (optional)</label><Input className="mt-1" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        </section>

        {/* Delivery mode */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode('pickup')} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${mode === 'pickup' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}><Store className="h-4 w-4" />Pickup in Store</button>
            <button type="button" onClick={() => setMode('delivery')} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${mode === 'delivery' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}><MapPin className="h-4 w-4" />Home Delivery</button>
          </div>
          {mode === 'delivery' && (
            <textarea className="w-full rounded-xl border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="House / flat, street, city, PIN code" value={form.address} onChange={(e) => set('address', e.target.value)} required />
          )}
          {mode === 'pickup' && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Store staff will contact you when your order is ready for pickup.</p>}
        </section>

        <textarea className="w-full rounded-xl border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading} className="metal-sheen h-11 flex-1 text-sm font-semibold text-[#17120b]">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing Order…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Place Order</>}
          </Button>
          <Link href={`${base}/catalog`} className="flex-1"><Button type="button" variant="outline" className="h-11 w-full">Continue Shopping</Button></Link>
        </div>
      </form>
    </main>
  );
}
