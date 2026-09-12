import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  size?: number;
  className?: string;
  /** Renders the numeric value beside the stars. */
  showValue?: boolean;
}

export function Rating({ value, size = 12, className, showValue = false }: RatingProps) {
  const rounded = Math.round(value);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="flex items-center text-amber-400" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={size}
            className={index < rounded ? 'fill-amber-400' : 'fill-transparent text-slate-300'}
          />
        ))}
      </span>
      {showValue && (
        <span className="font-mono text-[10px] font-bold text-slate-500">{value.toFixed(1)}</span>
      )}
      <span className="sr-only">{value.toFixed(1)} out of 5</span>
    </span>
  );
}
