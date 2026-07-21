'use client';

import { useEffect, useState } from 'react';
import { StarRating } from '@/components/ui/StarRating';
import { TrendBadge } from '@/components/ui/TrendBadge';
import type { ProductSalesData } from '@/lib/db/analytics';

export default function RestockPage() {
  const [products, setProducts] = useState<ProductSalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy] = useState<'stars' | 'units' | 'trend'>('stars');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics/store-manager/restock', {
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = (await res.json()) as { data: ProductSalesData[] };
        setProducts(json.data || []);
      } catch (error) {
        console.error('Error fetching restock data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...products].sort((a, b) => {
    if (sortBy === 'stars') return b.stars - a.stars;
    if (sortBy === 'units') return b.unitsLast30d - a.unitsLast30d;
    if (sortBy === 'trend') return Math.abs(b.trendPercent) - Math.abs(a.trendPercent);
    return 0;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Restock Guide</h1>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading restock data...</p>
        </div>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Restock Guide</h1>
        <div className="text-center py-12">
          <p className="text-gray-500">No orders in the last 30 days</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Restock Guide</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Products sorted by best-sellers from last 30 days
          </p>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Weight</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Rating</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Units (30d)</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sorted.map((product) => (
              <tr key={product.manufacturerProductId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm">{product.productName}</p>
                    <p className="text-xs text-gray-500">{product.designNumber}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {product.category || 'N/A'}
                  {product.subCategory && <p className="text-xs text-gray-500">{product.subCategory}</p>}
                </td>
                <td className="px-4 py-3 text-sm">{product.weight ? `${product.weight}g` : 'N/A'}</td>
                <td className="px-4 py-3 flex justify-center">
                  <StarRating count={product.stars} size="sm" />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                    {product.unitsLast30d}
                  </span>
                </td>
                <td className="px-4 py-3 flex justify-center">
                  <TrendBadge direction={product.trendDirection} percent={product.trendPercent} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold">{sorted.length}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-gray-600">Total Units (30d)</p>
          <p className="text-2xl font-bold">{sorted.reduce((sum, p) => sum + p.unitsLast30d, 0)}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-gray-600">Avg Rating</p>
          <p className="text-2xl font-bold">{(sorted.reduce((sum, p) => sum + p.stars, 0) / sorted.length).toFixed(1)}★</p>
        </div>
      </div>
    </div>
  );
}
