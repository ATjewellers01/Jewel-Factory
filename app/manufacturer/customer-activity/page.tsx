'use client';

import { Loader2, Activity, TrendingUp, TrendingDown, LogIn, LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useApi } from '@/hooks/use-api';

type OrderActivityRow = {
  storeId: string;
  storeName: string;
  isActive: boolean;
  lastOrderAt: string | null;
  ordersThisMonth: number;
  ordersTotal: number;
};

type OrdersResponse = {
  summary: { activatedRetailers: number; monthlyOrderingRetailers: number; inactiveRetailers: number };
  rows: OrderActivityRow[];
};

type LoginRow = {
  id: string;
  userType: 'RETAILER' | 'BRANCH_MANAGER';
  event: 'LOGIN' | 'LOGOUT';
  storeId: string;
  storeName: string | null;
  branchManagerId: string | null;
  branchManagerName: string | null;
  branchId: string | null;
  branchName: string | null;
  createdAt: string;
};

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function fmtDate(v: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CustomerActivityPage() {
  const { data: orderData, error: orderError, loading: orderLoading } = useApi<OrdersResponse>(
    '/api/manufacturer/activity/orders',
    '/manufacturer/login',
  );
  const { data: loginData, error: loginError, loading: loginLoading } = useApi<LoginRow[]>(
    '/api/manufacturer/activity/logins',
    '/manufacturer/login',
  );

  const [userTypeFilter, setUserTypeFilter] = useState<'ALL' | 'RETAILER' | 'BRANCH_MANAGER'>('ALL');
  const [eventFilter, setEventFilter] = useState<'ALL' | 'LOGIN' | 'LOGOUT'>('ALL');

  const filteredLogins = useMemo(() => {
    if (!loginData) return [];
    return loginData.filter(
      (r) => (userTypeFilter === 'ALL' || r.userType === userTypeFilter) && (eventFilter === 'ALL' || r.event === eventFilter),
    );
  }, [loginData, userTypeFilter, eventFilter]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Customer Activity</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Retailer &amp; Store Manager login activity and ordering engagement.
        </p>
      </div>

      {/* ── Order-based metrics ─────────────────────────────────────────── */}
      {orderError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{orderError}</div>}
      {orderLoading && <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {orderData && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Activated retailers" value={orderData.summary.activatedRetailers} icon={Activity} />
            <StatCard label="Ordering this month" value={orderData.summary.monthlyOrderingRetailers} icon={TrendingUp} />
            <StatCard label="Inactive (30+ days, no order)" value={orderData.summary.inactiveRetailers} icon={TrendingDown} />
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Retailer</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Orders this month</th>
                  <th className="px-4 py-2 font-medium">Orders total</th>
                  <th className="px-4 py-2 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody>
                {orderData.rows.map((r) => {
                  const inactive30d = !r.lastOrderAt || Date.now() - new Date(r.lastOrderAt).getTime() > 30 * 24 * 60 * 60 * 1000;
                  return (
                    <tr key={r.storeId} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{r.storeName}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            inactive30d ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {inactive30d ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2">{r.ordersThisMonth}</td>
                      <td className="px-4 py-2">{r.ordersTotal}</td>
                      <td className="px-4 py-2 text-muted-foreground">{fmtDate(r.lastOrderAt)}</td>
                    </tr>
                  );
                })}
                {orderData.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No retailers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Login / logout audit ───────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium tracking-tight">Login activity</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value as typeof userTypeFilter)}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              <option value="ALL">All roles</option>
              <option value="RETAILER">Retailer</option>
              <option value="BRANCH_MANAGER">Store Manager</option>
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as typeof eventFilter)}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              <option value="ALL">Login + Logout</option>
              <option value="LOGIN">Login only</option>
              <option value="LOGOUT">Logout only</option>
            </select>
          </div>
        </div>

        {loginError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loginError}</div>}
        {loginLoading && <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

        {loginData && (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Retailer</th>
                  <th className="px-4 py-2 font-medium">Store Manager</th>
                  <th className="px-4 py-2 font-medium">Store</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogins.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.event === 'LOGIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.event === 'LOGIN' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                        {r.event === 'LOGIN' ? 'Login' : 'Logout'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.userType === 'RETAILER' ? 'Retailer' : 'Store Manager'}</td>
                    <td className="px-4 py-2 font-medium">{r.storeName ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.branchManagerName ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.branchName ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
                {filteredLogins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No login activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Login activity is recorded going forward only — sign-ins from before this feature was added are not included.
        </p>
      </div>
    </div>
  );
}
