'use client';

import { ArrowUpRight, Building2, ClipboardCheck, Gem, ShoppingBag, Package, PencilLine, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { useApi } from '@/hooks/use-api';

type Dash = {
  pendingKiosk: number; pendingB2b: number; pendingCustom: number;
  totalKiosk: number; totalB2b: number; totalCustom: number; pendingTotal: number;
};

export default function StoreDashboardPage() {
  const { data, error, loading } = useApi<Dash>('/api/store/dashboard', '/store/login');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6e0d7] pb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#9a7229]">Retail operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Approvals and order activity across your retail network.</p>
        </div>
        <Link href="/store/manufacturer-catalog" className="inline-flex items-center gap-2 rounded-xl border border-[#e4ddd3] bg-white px-4 py-2.5 text-sm font-semibold text-[#4f4841] shadow-sm transition-colors hover:border-[#d7c49a] hover:text-[#946d28]">
          Browse catalog <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {data && (
        <>
          {data.pendingTotal > 0 && (
            <Link href="/store/pending-approvals">
              <div className="flex items-center gap-3 rounded-xl border border-[#ead7aa] bg-[#fff9e9] px-4 py-3.5 text-sm text-[#775818] transition-colors hover:bg-[#fff5d7]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#aa7c25] shadow-sm"><ClipboardCheck className="h-4 w-4" /></span>
                <span><strong>{data.pendingTotal}</strong> item{data.pendingTotal !== 1 ? 's are' : ' is'} waiting for your approval.</span>
                <ArrowUpRight className="ml-auto h-4 w-4" />
              </div>
            </Link>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card href="/store/kiosk-orders" icon={ShoppingBag} label="Kiosk Orders" total={data.totalKiosk} pending={data.pendingKiosk} />
            <Card href="/store/b2b-orders" icon={Package} label="Catalog Orders" total={data.totalB2b} pending={data.pendingB2b} />
            <Card href="/store/custom-designs" icon={PencilLine} label="Custom Designs" total={data.totalCustom} pending={data.pendingCustom} />
          </div>
          <section className="grid gap-3 border-t border-[#e6e0d7] pt-6 sm:grid-cols-2">
            <QuickLink href="/store/manufacturer-catalog" icon={Gem} title="Manufacturer catalog" description="Browse active designs and prepare a restock order." />
            <QuickLink href="/store/branches" icon={Building2} title="Stores and managers" description="Manage branches, restock PINs, and store teams." />
          </section>
        </>
      )}
    </div>
  );
}

function Card({ href, icon: Icon, label, total, pending }: { href: string; icon: typeof ShoppingBag; label: string; total: number; pending: number }) {
  return (
    <Link href={href}>
      <div className="group rounded-2xl border border-[#e5dfd6] bg-white p-5 shadow-[0_8px_30px_rgba(52,42,30,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#d9c69d] hover:shadow-[0_12px_34px_rgba(52,42,30,0.07)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#4b443d]">{label}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf6ea] text-[#a77d31]"><Icon className="h-4 w-4" /></div>
        </div>
        <p className="mt-5 text-3xl font-semibold tabular-nums tracking-tight">{total}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={pending > 0 ? 'font-medium text-[#9b722b]' : 'text-muted-foreground'}>{pending > 0 ? `${pending} pending approval` : 'No pending items'}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-[#a69b90] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: typeof Gem; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e8dfce] bg-[#fbf6ea] text-[#a77d31]"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span>
      <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[#a69b90] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
