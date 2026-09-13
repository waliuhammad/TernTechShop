import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Seo } from '@/components/ui/Seo';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { evaluateCoupon, fetchCoupon } from '@/lib/coupons';
import type { Coupon } from '@/types';
import { formatPrice } from '@/lib/money';

export default function Cart() {
  const { lines, getTotals, updateQuantity, removeItem, clear } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // Derived every render, so changing quantities re-prices the discount
  // (and drops it if the cart falls below the coupon's minimum).
  const subtotalNow = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const evaluation = appliedCoupon ? evaluateCoupon(appliedCoupon, subtotalNow) : null;
  const discount = evaluation?.status === 'valid' ? evaluation.discount : 0;
  const totals = getTotals(discount);

  const applyCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!couponInput.trim()) return;

    setCheckingCoupon(true);
    const coupon = await fetchCoupon(couponInput);
    setCheckingCoupon(false);

    if (!coupon || coupon.isActive === false) {
      notify('That discount protocol is not recognised.', 'error');
      return;
    }

    const result = evaluateCoupon(coupon, totals.subtotal);
    if (result.status === 'below-minimum') {
      notify(
        `Manifest must exceed ${formatPrice(result.minOrderAmount)} to apply ${coupon.code}.`,
        'error',
      );
      return;
    }
    if (result.status !== 'valid') {
      notify('That discount protocol is not recognised.', 'error');
      return;
    }

    setAppliedCoupon(coupon);
    notify(`${coupon.code} applied — ${formatPrice(result.discount)} deducted.`);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
  };

  if (lines.length === 0) {
    return (
      <div className="min-h-[70vh] bg-white">
        <Seo noindex title="Hardware Cart" description="Your Tern Technologies hardware cart." />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <EmptyState
            icon={ShoppingCart}
            title="Your hardware cart is empty!"
            description="Your architecture is waiting to be built. Start your journey today!"
            actionLabel="Browse Components"
            actionHref="/shop"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo noindex title="Hardware Cart" description="Review your hardware manifest before deployment." />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-16">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
              // MANIFEST_REVIEW
            </p>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
              Hardware <span className="text-primary not-italic">Cart</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              void clear();
              removeCoupon();
              notify('Manifest cleared.', 'info');
            }}
            className="cursor-pointer text-[10px] font-black tracking-widest text-slate-400 uppercase transition-colors hover:text-rose-500"
          >
            Purge Manifest
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Lines */}
          <div className="space-y-4 lg:col-span-2">
            {lines.map((line) => (
              <article
                key={line.product.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
              >
                <Link
                  to={`/product/${line.product.slug}`}
                  className="flex h-24 w-24 shrink-0 items-center justify-center self-center rounded-xl border border-slate-100 bg-slate-50 p-2 sm:self-auto"
                >
                  <img
                    src={line.product.images[0]}
                    alt={line.product.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </Link>

                <div className="min-w-0 flex-grow space-y-1">
                  <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                    {line.product.category} // {line.product.sku}
                  </p>
                  <h2 className="font-bold text-slate-900">
                    <Link
                      to={`/product/${line.product.slug}`}
                      className="transition-colors hover:text-primary"
                    >
                      {line.product.name}
                    </Link>
                  </h2>
                  <p className="text-sm font-bold text-slate-500">
                    {formatPrice(line.product.price)} each
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-3">
                  <QuantitySelector
                    size="sm"
                    value={line.quantity}
                    max={line.product.stock}
                    onChange={(next) => void updateQuantity(line.product.id, next)}
                  />
                  <div className="flex items-center gap-4">
                    <p className="font-black whitespace-nowrap text-slate-900">
                      {formatPrice(line.lineTotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void removeItem(line.product.id);
                        notify('Component removed from manifest.', 'info');
                      }}
                      aria-label={`Remove ${line.product.name}`}
                      className="cursor-pointer rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </article>
            ))}

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 pt-4 text-[10px] font-black tracking-widest text-primary uppercase transition-all hover:gap-4"
            >
              Source More Components
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
              <h2 className="border-l-4 border-primary pl-4 text-lg font-black tracking-tighter uppercase italic">
                Manifest Summary
              </h2>

              {/* Coupon */}
              <form onSubmit={(event) => void applyCoupon(event)} className="space-y-3">
                <label
                  htmlFor="coupon"
                  className="font-mono text-[10px] tracking-widest text-slate-400 uppercase"
                >
                  Discount Protocol
                </label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <span className="font-mono text-xs font-black text-emerald-700 uppercase">
                      {appliedCoupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="cursor-pointer text-[10px] font-black text-emerald-700 uppercase hover:text-emerald-900"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="coupon"
                      value={couponInput}
                      onChange={(event) => setCouponInput(event.target.value)}
                      placeholder="DEPLOY10"
                      className="field-input flex-grow font-mono text-xs tracking-widest uppercase"
                    />
                    <button
                      type="submit"
                      disabled={checkingCoupon}
                      className="tech-btn shrink-0 px-5 text-xs"
                    >
                      {checkingCoupon ? '…' : 'Apply'}
                    </button>
                  </div>
                )}
                {evaluation?.status === 'below-minimum' && (
                  <p className="text-xs font-bold text-amber-600">
                    {appliedCoupon?.code} needs a manifest above{' '}
                    {formatPrice(evaluation.minOrderAmount)} — discount paused.
                  </p>
                )}
              </form>

              <dl className="space-y-3 border-t border-slate-100 pt-6 text-sm">
                <div className="flex justify-between">
                  <dt className="font-medium text-slate-500">Subtotal</dt>
                  <dd className="font-bold text-slate-900">{formatPrice(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <dt className="font-medium">Discount</dt>
                    <dd className="font-bold">-{formatPrice(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="font-medium text-slate-500">Logistics</dt>
                  <dd className="font-bold text-slate-900">
                    {totals.shipping === 0 ? (
                      <span className="text-emerald-600">Free</span>
                    ) : (
                      formatPrice(totals.shipping)
                    )}
                  </dd>
                </div>
              </dl>

              {totals.freeShippingShortfall > 0 && (
                <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed font-medium text-primary">
                  Add {formatPrice(totals.freeShippingShortfall)} more to qualify for free
                  logistics.
                </p>
              )}

              <div className="flex items-end justify-between border-t border-slate-100 pt-6">
                <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                  Total Valuation
                </span>
                <span className="text-2xl font-black tracking-tighter text-slate-900 md:text-3xl">
                  {formatPrice(totals.total)}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/checkout', {
                    state: appliedCoupon && discount > 0 ? { couponCode: appliedCoupon.code } : undefined,
                  })
                }
                className="primary-btn flex w-full items-center justify-center gap-3 py-4 text-base"
              >
                Initialize Checkout
                <ArrowRight size={18} />
              </button>

              <div className="flex flex-col items-center gap-4 pt-2 opacity-40">
                <div className="h-px w-full bg-slate-200" />
                <span className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase">
                  Enterprise Sourced Hardware
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
