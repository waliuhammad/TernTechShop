import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 text-slate-300">
        <Icon size={40} />
      </div>
      <h2 className="mb-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      <p className="mb-10 max-w-md leading-relaxed font-medium text-slate-500 italic">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link to={actionHref} className="primary-btn">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
