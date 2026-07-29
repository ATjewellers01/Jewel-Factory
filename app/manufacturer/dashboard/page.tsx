'use client';

import { ArrowRight, Package, ShoppingBag, Users, ClipboardCheck, Store as StoreIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Dashboard = {
  totalDesigns: number;
  activeDesigns: number;
  pendingB2b: number;
  pendingKiosk: number;
  pendingRegistrations: number;
  activeStores: number;
  recentB2b: {
    id: string;
    orderNumber: string;
    status: string;
    totalItems: number;
    createdAt: string;
    storeName: string | null;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

function Stat({ label, value, icon: Icon, href }: { label: string; value: number; icon: typeof Package; href: string }) {
  return (
    <Link href={href}>
      <div className="group rounded-2xl border border-[#e5dfd6] bg-white p-5 shadow-[0_8px_30px_rgba(52,42,30,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#d9c69d] hover:shadow-[0_12px_34px_rgba(52,42,30,0.07)]">
        <div className="flex items-center justify-between">
          <p className="max-w-[120px] text-[10px] font-bold uppercase tracking-[0.12em] text-[#8e847a]">{label}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf6ea] text-[#a77d31]">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between"><p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p><ArrowRight className="mb-1 h-3.5 w-3.5 text-[#aaa096] transition-transform group-hover:translate-x-1" /></div>
      </div>
    </Link>
  );
}

export default function ManufacturerDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/manufacturer/dashboard', { cache: 'no-store' });
        if (res.status === 401) { window.location.assign('/manufacturer/login'); return; }
        const json = (await res.json()) as { data?: Dashboard; error?: { message: string } };
        if (!res.ok || json.error) { setError(json.error?.message ?? 'Failed to load'); return; }
        setData(json.data!);
      } catch {
        setError('Network error');
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6e0d7] pb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#9a7229]">Manufacturing operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Catalog health, open work, and purchase manager activity.</p>
        </div>
        <Link href="/manufacturer/catalog/new" className="inline-flex items-center gap-2 rounded-xl bg-[#c99d37] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_7px_20px_rgba(174,127,30,0.2)] transition-colors hover:bg-[#b98e30]">
          Add design <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!data && !error && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total Designs" value={data.totalDesigns} icon={Package} href="/manufacturer/catalog" />
            <Stat label="Active" value={data.activeDesigns} icon={Package} href="/manufacturer/catalog" />
            <Stat label="Catalog Pending" value={data.pendingB2b} icon={ShoppingBag} href="/manufacturer/orders" />
            <Stat label="Kiosk Pending" value={data.pendingKiosk} icon={Users} href="/manufacturer/kiosk-orders" />
            <Stat label="Pending Approval" value={data.pendingRegistrations} icon={ClipboardCheck} href="/manufacturer/store-registrations" />
            <Stat label="Active Purchase managers" value={data.activeStores} icon={StoreIcon} href="/manufacturer/stores" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e5dfd6] bg-white shadow-[0_8px_30px_rgba(52,42,30,0.035)]">
            <div className="flex items-center justify-between border-b border-[#ece6dd] px-5 py-4">
              <div><p className="text-sm font-semibold">Recent Catalog orders</p><p className="mt-0.5 text-xs text-muted-foreground">Latest restock activity from the purchase manager network.</p></div>
              <Link href="/manufacturer/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#946d28] hover:text-[#75531c]">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {data.recentB2b.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="divide-y">
                {data.recentB2b.map((o) => (
                  <Link key={o.id} href={`/manufacturer/orders/${o.id}`}>
                    <div className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#faf7f1]">
                      <div>
                        <p className="text-sm font-medium">{o.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.storeName ?? '—'} · {o.totalItems} item{o.totalItems !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? ''}`}>
                        {o.status.toLowerCase()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
