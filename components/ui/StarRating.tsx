import { Star } from 'lucide-react';

interface StarRatingProps {
  count: number; // 1-5
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ count, showLabel = false, size = 'md' }: StarRatingProps) {
  const sizeMap = { sm: 14, md: 16, lg: 20 };
  const sz = sizeMap[size];

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={sz}
          className={
            i < count
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }
        />
      ))}
      {showLabel && (
        <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
          {count}/5
        </span>
      )}
    </div>
  );
}
