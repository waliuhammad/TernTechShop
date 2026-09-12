import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminPageHeader({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-end">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-4xl">
          {title} <span className="text-primary not-italic">{accent}</span>
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SHIPPED: 'bg-violet-50 text-violet-700 border-violet-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border px-3 py-1 text-[10px] font-black tracking-widest whitespace-nowrap uppercase',
        STATUS_STYLES[status] ?? 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6">
      <p className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">{label}</p>
      <p
        className={cn(
          // No truncation: a revenue figure that gets cut off is worse than one that wraps.
          'text-xl leading-tight font-black tracking-tighter break-words sm:text-2xl 2xl:text-3xl',
          tone === 'warn' ? 'text-amber-600' : 'text-slate-900',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs font-medium text-slate-400">{hint}</p>}
    </div>
  );
}

export function AdminSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-6 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600"
    >
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

/** Horizontal-scroll wrapper so wide tables never widen the page on mobile. */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">{children}</div>
  );
}

export const thClass =
  'px-5 py-4 text-left font-mono text-[10px] font-bold tracking-widest whitespace-nowrap text-slate-400 uppercase';
export const tdClass = 'px-5 py-4 align-middle';
