import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantitySelectorProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** `lg` is the product page stepper; `sm` is the cart row. */
  size?: 'sm' | 'lg';
}

export function QuantitySelector({ value, max, onChange, size = 'lg' }: QuantitySelectorProps) {
  const buttonSize = size === 'lg' ? 'h-14 w-14' : 'h-9 w-9';
  const valueSize = size === 'lg' ? 'w-16 text-2xl' : 'w-10 text-base';

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 shadow-inner">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40',
          buttonSize,
        )}
      >
        <Minus size={size === 'lg' ? 18 : 14} />
      </button>

      <span
        aria-live="polite"
        className={cn('text-center font-mono font-black text-slate-900', valueSize)}
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40',
          buttonSize,
        )}
      >
        <Plus size={size === 'lg' ? 18 : 14} />
      </button>
    </div>
  );
}
