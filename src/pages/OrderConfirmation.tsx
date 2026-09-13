import { CheckCircle2, Clock, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PaymentPanel } from '@/components/payment/PaymentPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/money';
import { watchOrderByManifest, type OrderDoc } from '@/services/orders';
import { PAYMENT_METHOD_LABELS } from '@/services/payments';
import { formatDateTime } from '@/lib/utils';

export default function OrderConfirmation() {
  const { manifestId } = useParams<{ manifestId: string }>();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  // Set by checkout when the order was placed but the wallet payment couldn't start.
  const paymentError = (location.state as { paymentError?: string } | null)?.paymentError ?? '';

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Live: a wallet payment moves from "approve on your phone" to paid while
  // the customer watches.
  useEffect(() => {
    if (authLoading || !user || !manifestId) return undefined;
    return watchOrderByManifest(
      user.uid,
      manifestId,
      (result) => {
        setOrder(result);
        setLoading(false);
      },
      (error) => {
        console.error('Order fetch error:', error);
        setLoading(false);
      },
    );
  }, [user, manifestId, authLoading]);

  if (authLoading || (user && manifestId && loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] bg-white">
        <Seo noindex title="Order Not Found" />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <EmptyState
            icon={Package}
            title="Order Not Found"
            description="No manifest with that identifier is registered to your account."
            actionLabel="View All Deployments"
            actionHref="/orders"
          />
        </div>
      </div>
    );
  }

  const online = order.paymentMethod !== 'COD';
  const awaitingPayment = online && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';
  const headline = order.status === 'CANCELLED'
    ? 'Order Cancelled'
    : awaitingPayment
      ? 'Order Placed — Payment Pending'
      : online
        ? 'Order Confirmed & Paid!'
        : 'Order Confirmed!';

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo noindex title={headline} description="Your hardware manifest has been registered." />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl md:p-12">
          <div
            className={
              awaitingPayment || order.status === 'CANCELLED'
                ? 'mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500'
                : 'mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500'
            }
          >
            {awaitingPayment || order.status === 'CANCELLED' ? <Clock size={44} /> : <CheckCircle2 size={44} />}
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-4xl">
              {headline}
            </h1>
            <p className="font-medium text-slate-500">
              {awaitingPayment
                ? `Your items are reserved. Complete the ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? ''} payment below to confirm the order.`
                : order.status === 'CANCELLED'
                  ? 'This order has been cancelled.'
                  : `Your hardware manifest is now in our logistics pipeline. Our engineers will contact you on ${order.phone} to confirm the deployment.`}
            </p>
          </div>

          <div className="inline-block rounded-xl border border-primary/20 bg-primary/10 px-6 py-3">
            <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Manifest ID
            </p>
            <p className="font-mono text-2xl font-black tracking-widest text-primary">
              {order.manifestId}
            </p>
          </div>

          <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
            Placed {formatDateTime(order.createdAt)} // {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} // {order.status}
          </p>
        </div>

        {online && (
          <div className="mt-8">
            <PaymentPanel order={order} initialError={paymentError} />
          </div>
        )}

        {/* Manifest detail */}
        <div className="mt-8 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-10">
          <h2 className="border-l-4 border-primary pl-4 text-lg font-black tracking-tighter uppercase italic">
            Cargo Manifest
          </h2>

          <ul className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.productId} className="flex items-center gap-4 py-4">
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1"
                />
                <div className="min-w-0 flex-grow">
                  <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                  <p className="font-mono text-[10px] text-slate-400 uppercase">
                    x{item.quantity} // {item.sku}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-3 border-t border-slate-100 pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="font-medium text-slate-500">Subtotal</dt>
              <dd className="font-bold">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt className="font-medium">
                  Discount {order.couponCode && `(${order.couponCode})`}
                </dt>
                <dd className="font-bold">-{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="font-medium text-slate-500">Logistics</dt>
              <dd className="font-bold">
                {order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-lg">
              <dt className="font-black text-slate-900">Total</dt>
              <dd className="font-black text-slate-900">{formatPrice(order.total)}</dd>
            </div>
          </dl>

          <div className="space-y-2 rounded-2xl bg-slate-50 p-6">
            <h3 className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
              Deployment Destination
            </h3>
            <p className="text-sm font-bold text-slate-900">{order.fullName}</p>
            <p className="text-sm font-medium text-slate-600">{order.address}</p>
            <p className="text-sm font-medium text-slate-600">
              {order.city} // {order.phone}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/orders" className="secondary-btn flex-grow text-center">
              View All Deployments
            </Link>
            <Link to="/shop" className="primary-btn flex-grow text-center">
              Source More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
