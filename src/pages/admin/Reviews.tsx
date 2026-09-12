import { Check, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminError, AdminPageHeader, AdminSpinner } from '@/components/admin/AdminUI';
import { Rating } from '@/components/ui/Rating';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { cn, formatDateTime } from '@/lib/utils';
import {
  deleteReview,
  fetchAllReviews,
  moderateReview,
  type ReviewDoc,
  type ReviewStatus,
} from '@/services/reviews';

const TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: 'PENDING', label: 'Awaiting approval' },
  { key: 'APPROVED', label: 'Published' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function AdminReviews() {
  const { user } = useAuth();
  const { products, refresh } = useCatalog();
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(() => fetchAllReviews(), 'admin-reviews');

  const [tab, setTab] = useState<ReviewStatus>('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);

  const productOf = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const reviews = data ?? [];
  const visible = reviews.filter((review) => review.status === tab);
  const countOf = (status: ReviewStatus) => reviews.filter((review) => review.status === status).length;

  const act = async (review: ReviewDoc, action: () => Promise<void>, message: string) => {
    setBusyId(review.id);
    try {
      await action();
      notify(message);
      reload();
      await refresh(); // star ratings on product cards may have changed
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <AdminPageHeader eyebrow="// FEEDBACK_MODERATION" title="Customer" accent="Reviews" />
      <AdminError message={error} />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'cursor-pointer rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors',
              tab === key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400',
            )}
          >
            {label} <span className="opacity-60">{countOf(key)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <AdminSpinner />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          {tab === 'PENDING' ? 'No reviews waiting — all caught up.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((review) => {
            const product = productOf.get(review.productId);
            const busy = busyId === review.id;
            return (
              <li key={review.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Rating value={review.rating} size={16} />
                    {review.title && <p className="font-black text-slate-900">{review.title}</p>}
                    <p className="text-xs text-slate-400">
                      {review.authorName} · {formatDateTime(review.createdAt)}
                    </p>
                  </div>
                  {product ? (
                    <Link
                      to={`/product/${product.slug}`}
                      target="_blank"
                      className="max-w-xs truncate text-xs font-bold text-primary hover:underline"
                    >
                      {product.name}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-slate-400">{review.productId}</span>
                  )}
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{review.body}</p>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {review.status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={busy || !user}
                      onClick={() => user && void act(review, () => moderateReview(review, 'APPROVED', user.uid), 'Review published.')}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                  )}
                  {review.status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={busy || !user}
                      onClick={() => user && void act(review, () => moderateReview(review, 'REJECTED', user.uid), 'Review rejected.')}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X size={14} /> {review.status === 'APPROVED' ? 'Unpublish' : 'Reject'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm('Delete this review permanently?')) return;
                      void act(review, () => deleteReview(review), 'Review deleted.');
                    }}
                    className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Approving or rejecting recalculates the product's star rating from its published reviews.
      </p>
    </div>
  );
}
