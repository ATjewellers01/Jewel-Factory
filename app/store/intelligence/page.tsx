'use client';

import { useEffect, useState } from 'react';
import { StarRating } from '@/components/ui/StarRating';
import type { ProductSalesData, BranchSalesData } from '@/lib/db/analytics';

export default function IntelligencePage() {
  const [branches, setBranches] = useState<BranchSalesData[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/store/branches', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = (await res.json()) as { data: BranchSalesData[] };
        const data = json.data || [];
        setBranches(data);
        if (data.length > 0) setSelectedBranchId(data[0].branchId);
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-6">Loading...</div>;
  if (!branches.length) return <div className="max-w-6xl mx-auto px-4 py-6">No data available</div>;

  const branch = branches.find(b => b.branchId === selectedBranchId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Intelligence Dashboard</h1>

      {/* Branch Selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {branches.map(b => (
          <button
            key={b.branchId}
            onClick={() => setSelectedBranchId(b.branchId)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              selectedBranchId === b.branchId
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'
            }`}
          >
            {b.branchName}
          </button>
        ))}
      </div>

      {branch && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-4">Top Products</h2>
            <div className="space-y-3">
              {branch.topProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">{p.productName}</p>
                    <p className="text-xs text-gray-500">{p.category}{p.subCategory ? ` • ${p.subCategory}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating count={p.stars} size="sm" />
                    <span className="font-bold">{p.units}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-4">By Category</h2>
            <div className="space-y-2">
              {Object.entries(branch.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, units]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm">{cat}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (units / Object.values(branch.byCategory).reduce((a, b) => a + b, 0)) * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-sm w-12 text-right">{units}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Weight Range */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 lg:col-span-2">
            <h2 className="text-lg font-bold mb-4">By Weight Range</h2>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(branch.byWeight)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([range, units]) => (
                  <div key={range} className="border rounded p-3 text-center hover:bg-gray-50 dark:hover:bg-gray-800">
                    <p className="font-semibold text-sm">{range}</p>
                    <p className="text-lg font-bold">{units}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
