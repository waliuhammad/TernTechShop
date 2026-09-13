import { cn } from '@/lib/utils';
import { WALLET_LABELS } from '@/services/payments';

const STYLES: Record<string, string> = {
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  UNPAID: 'border-slate-200 bg-slate-100 text-slate-600',
  PROCESSING: 'border-blue-200 bg-blue-50 text-blue-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  REVIEW: 'border-amber-300 bg-amber-50 text-amber-800',
  EXPIRED: 'border-slate-200 bg-slate-100 text-slate-500',
};

const LABELS: Record<string, string> = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  PROCESSING: 'Paying…',
  FAILED: 'Payment failed',
  REVIEW: 'Check payment',
  EXPIRED: 'Not paid',
};

/** "COD", or "JazzCash · Paid" style pill for wallet orders. */
export function PaymentBadge({ method, status, className }: { method: string; status?: string; className?: string }) {
  const base = 'inline-block rounded-full border px-3 py-1 text-[10px] font-black tracking-widest whitespace-nowrap uppercase';
  if (method !== 'JAZZCASH' && method !== 'EASYPAISA') {
    return <span className={cn(base, 'border-slate-200 bg-white text-slate-500', className)}>COD</span>;
  }
  const state = status ?? 'UNPAID';
  return (
    <span className={cn(base, STYLES[state] ?? STYLES.UNPAID, className)}>
      {WALLET_LABELS[method]} · {LABELS[state] ?? state}
    </span>
  );
}
