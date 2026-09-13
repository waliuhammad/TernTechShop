import { Package, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/money';
import { fetchUserOrders, type OrderDoc } from '@/services/orders';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PROCESSING: 'bg-blue-50 text-blue-700',
  SHIPPED: 'bg-indigo-50 text-indigo-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return undefined;

    let active = true;
    fetchUserOrders(user.uid)
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((caught) => {
        console.error('Orders fetch error:', caught);
        if (active) setError('Could not reach the manifest registry. Try again shortly.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  // Only a signed-in user has anything to wait for.
  if (authLoading || (user && loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-slate-50">
        <Seo noindex title="My Deployments" />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white">
            <EmptyState
              icon={Package}
              title="Login to see your deployments"
              description="Your manifest registry is tied to your operator identity. Sign in to review past deployments."
              actionLabel="Initialize Session"
              actionHref="/login"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Seo noindex title="My Deployments" description="Track your hardware logistics across the network." />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10 space-y-2 md:mb-16">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
            // MANIFEST_REGISTRY
          </p>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
            My <span className="text-primary not-italic">Deployments</span>
          </h1>
          <p className="max-w-xl font-medium text-slate-500">
            Track your hardware logistics across the network.
          </p>
        </div>

        {error && (
          <p className="mb-6 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {orders.length === 0 && !error ? (
          <div className="rounded-3xl border border-slate-200 bg-white">
            <EmptyState
              icon={Package}
              title="No active manifests"
              description="Your hardware infrastructure begins with your first authorization."
              actionLabel="Browse Components"
              actionHref="/shop"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/order-confirmation/${order.manifestId}`)}
                className="block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-primary/30 hover:shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-mono text-lg font-black tracking-widest text-primary">
                      {order.manifestId}
                    </p>
                    <p className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">
                      {formatDateTime(order.createdAt)} // {order.items.length}{' '}
                      {order.items.length === 1 ? 'line' : 'lines'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black tracking-tighter text-slate-900">
                      {formatPrice(order.total)}
                    </p>
                    <span
                      className={cn(
                        'inline-block rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase',
                        STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex -space-x-3 border-t border-slate-100 pt-4">
                  {order.items.slice(0, 5).map((item) => (
                    <img
                      key={item.productId}
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain p-1"
                    />
                  ))}
                  {order.items.length > 5 && (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-mono text-[10px] font-black text-slate-500">
                      +{order.items.length - 5}
                    </span>
                  )}
                </div>
              </button>
            ))}

            <p className="pt-4 text-center text-xs font-medium text-slate-400">
              Need help with a manifest?{' '}
              <Link to="/contact" className="text-primary underline">
                Contact an engineer
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
