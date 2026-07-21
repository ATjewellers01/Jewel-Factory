import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendBadgeProps {
  direction: 'up' | 'down' | 'stable';
  percent?: number;
  size?: 'sm' | 'md';
}

export function TrendBadge({ direction, percent = 0, size = 'sm' }: TrendBadgeProps) {
  const sizeMap = { sm: 14, md: 16 };
  const sz = sizeMap[size];

  if (direction === 'up') {
    return (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
        <TrendingUp size={sz} />
        <span className="text-xs font-semibold">+{percent}%</span>
      </div>
    );
  }

  if (direction === 'down') {
    return (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-500">
        <TrendingDown size={sz} />
        <span className="text-xs font-semibold">-{Math.abs(percent)}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
      <Minus size={sz} />
      <span className="text-xs font-semibold">stable</span>
    </div>
  );
}
