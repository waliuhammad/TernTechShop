import { Lock, ShieldCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Rating } from '@/components/ui/Rating';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { isFirebaseConfigured } from '@/lib/firebase';
import { cn, formatDate } from '@/lib/utils';
import {
  deleteOwnReview,
  fetchApprovedReviews,
  fetchMyReview,
  submitReview,
} from '@/services/reviews';
import type { Product } from '@/types';

export function ReviewsSection({ product }: { product: Product }) {
  const { user, profile, suspended } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const approved = useAsync(
    () => (isFirebaseConfigured ? fetchApprovedReviews(product.id) : Promise.resolve([])),
    `reviews-${product.id}`,
  );
  const mine = useAsync(
    () => (user ? fetchMyReview(product.id, user.uid) : Promise.resolve(null)),
    `my-review-${product.id}-${user?.uid ?? 'guest'}`,
  );

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reviews = approved.data ?? [];
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, review) => sum + review.rating, 0) / count : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (rating < 1) return setError('Choose a star rating.');
    if (body.trim().length < 10) return setError('Write at least a sentence (10 characters).');

    setBusy(true);
    setError('');
    try {
      await submitReview({
        productId: product.id,
        uid: user.uid,
        authorName: profile?.name || user.displayName || 'Customer',
        rating,
        title,
        body,
      });
      notify('Review received — it will appear once our team approves it.');
      setRating(0);
      setTitle('');
      setBody('');
      mine.reload();
    } catch (caught) {
      console.error('Review submit failed:', caught);
      setError('Could not submit your review. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!user || !window.confirm('Withdraw your review? You can write a new one afterwards.')) return;
    setBusy(true);
    try {
      await deleteOwnReview(product.id, user.uid);
      notify('Review withdrawn.', 'info');
      mine.reload();
      approved.reload();
    } catch {
      notify('Could not withdraw the review.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const myReview = mine.data ?? null;

  return (
    <section className="mt-24 space-y-12 md:mt-32">
      <div className="flex flex-col justify-between gap-8 border-b border-slate-200 pb-10 md:flex-row md:items-end">
        <div className="space-y-4">
          <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
            User <span className="gradient-text uppercase not-italic">Deployments</span>
          </h2>
          <p className="font-mono text-xs tracking-widest text-slate-400 uppercase italic md:text-sm">
            // FEEDBACK_STREAM: VERIFIED
          </p>
        </div>

        <div className="flex items-center gap-6 rounded-2xl border border-slate-200 bg-white px-8 py-5 shadow-2xl md:gap-8 md:px-10 md:py-6">
          <div className="text-right">
            <p className="mb-1 font-mono text-[10px] font-black tracking-widest text-slate-400 uppercase">
              Architecture Trust
            </p>
            {count ? (
              <p className="text-3xl font-black text-slate-900 italic md:text-4xl">
                {average.toFixed(1)}
                <span className="text-tech-blue">/</span>5
              </p>
            ) : (
              <p className="text-lg font-black text-slate-400 italic">No reviews yet</p>
            )}
            <p className="font-mono text-[10px] text-slate-400 uppercase">
              {count} {count === 1 ? 'review' : 'reviews'}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-tech-blue md:h-16 md:w-16">
            <ShieldCheck size={28} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        {/* Write a review */}
        <div className="relative h-fit space-y-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-10">
          <h3 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
            Submit <span className="text-tech-blue not-italic">Diagnostic</span>
          </h3>

          {!isFirebaseConfigured ? (
            <p className="text-sm text-slate-400">Reviews are unavailable right now.</p>
          ) : !user ? (
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 py-12 text-center">
              <Lock className="mx-auto text-slate-300" size={28} />
              <p className="text-lg font-bold text-slate-900 italic">Sign in to review this unit</p>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="tech-btn px-8 py-3 font-mono text-xs tracking-widest uppercase"
              >
                Initialize Session
              </button>
            </div>
          ) : mine.loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ) : myReview ? (
            <div
              className={cn(
                'space-y-3 rounded-2xl border p-6',
                myReview.status === 'APPROVED' && 'border-emerald-200 bg-emerald-50',
                myReview.status === 'PENDING' && 'border-amber-200 bg-amber-50',
                myReview.status === 'REJECTED' && 'border-slate-200 bg-slate-50',
              )}
            >
              <p className="font-bold text-slate-900">
                {myReview.status === 'APPROVED' && 'Your review is live — thank you.'}
                {myReview.status === 'PENDING' && 'Your review is waiting for approval.'}
                {myReview.status === 'REJECTED' && "Your review wasn't published."}
              </p>
              <Rating value={myReview.rating} size={14} />
              <p className="text-sm text-slate-600 italic">“{myReview.body}”</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void withdraw()}
                className="cursor-pointer text-xs font-black tracking-widest text-slate-500 uppercase hover:text-rose-600"
              >
                Withdraw review
              </button>
            </div>
          ) : suspended ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
              This account can't post reviews right now.
            </p>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-5">
              <div>
                <p className="terminal-label mb-2 text-slate-500">Your rating</p>
                <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHover(value)}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      aria-pressed={rating === value}
                      className="cursor-pointer p-1"
                    >
                      <Star
                        size={28}
                        className={cn(
                          'transition-colors',
                          (hover || rating) >= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="terminal-label text-slate-500">Title (optional)</span>
                <input
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  className="field-input"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="terminal-label text-slate-500">Your review</span>
                <textarea
                  rows={4}
                  value={body}
                  maxLength={2000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="How has it performed? Thermals, stability, delivery…"
                  className="field-input resize-none"
                />
              </label>
              {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
              <button type="submit" disabled={busy} className="tech-btn w-full py-4 text-sm tracking-widest uppercase">
                {busy ? 'Transmitting…' : 'Submit review'}
              </button>
              <p className="text-xs text-slate-400">Reviews are checked by our team before they appear.</p>
            </form>
          )}
        </div>

        {/* Approved reviews */}
        <div className="space-y-6">
          {approved.loading ? (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          ) : reviews.length === 0 ? (
            <p className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400 italic">
              Empty manifest: no deployment logs for this unit yet. Be the first to review it.
            </p>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-xl transition-all hover:border-tech-blue/50"
              >
                <div className="absolute top-0 right-0 bottom-0 w-1 bg-tech-blue opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900">{review.authorName}</p>
                    <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <Rating value={review.rating} size={14} />
                </div>
                {review.title && <p className="mb-2 font-bold text-slate-800">{review.title}</p>}
                <p className="border-l-2 border-slate-100 pl-4 font-mono text-sm leading-relaxed font-medium whitespace-pre-line text-slate-600 italic transition-all group-hover:border-tech-blue/30">
                  “{review.body}”
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
