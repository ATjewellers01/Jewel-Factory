'use client';

import { useEffect, useState } from 'react';

interface TopProduct {
  id: string;
  name: string;
  designNumber: string;
  category: string;
  units: number;
}

interface ManufacturerOverview {
  totalUnits: number;
  topProducts: TopProduct[];
  categoryDistribution: Record<string, number>;
  weightDistribution: Record<string, number>;
}

export default function ManufacturerIntelligencePage() {
  const [data, setData] = useState<ManufacturerOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/manufacturer/overview', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = (await res.json()) as { data: ManufacturerOverview };
        setData(json.data);
      } catch (error) {
        console.error('Error fetching overview:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-6">Loading...</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-6">No data available</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Intelligence Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Units (30d)</p>
          <p className="text-3xl font-bold">{data.totalUnits}</p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Top Product</p>
          <p className="text-sm font-semibold mt-1">{data.topProducts?.[0]?.name || 'N/A'}</p>
          <p className="text-lg font-bold text-blue-600">{data.topProducts?.[0]?.units || 0} units</p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
          <p className="text-3xl font-bold">{Object.keys(data.categoryDistribution || {}).length}</p>
        </div>
      </div>

      {/* Top 10 Products */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-bold mb-4">Top 10 Products (All Retailers)</h2>
        <div className="space-y-2">
          {data.topProducts?.map((p: TopProduct, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
              <div>
                <p className="font-semibold text-sm">#{idx + 1} {p.name}</p>
                <p className="text-xs text-gray-500">{p.designNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{p.units}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-4">By Category</h2>
          <div className="space-y-2">
            {Object.entries(data.categoryDistribution || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([cat, units]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm">{cat}</span>
                  <span className="font-semibold">{units}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Weight Distribution */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-4">By Weight Range</h2>
          <div className="space-y-2">
            {Object.entries(data.weightDistribution || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([range, units]) => (
                <div key={range} className="flex items-center justify-between">
                  <span className="text-sm">{range}</span>
                  <span className="font-semibold">{units}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
