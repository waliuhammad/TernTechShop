import { ArrowRight, Inbox, MessageSquareText, PackageX, ShieldCheck, Truck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminError,
  AdminPageHeader,
  AdminSpinner,
  StatCard,
  StatusBadge,
} from '@/components/admin/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { formatPrice } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { fetchAllOrders, fetchAllProducts } from '@/services/admin';
import { fetchContactMessages, fetchWarranties } from '@/services/inbox';
import { fetchAllReviews } from '@/services/reviews';

const LOW_STOCK_THRESHOLD = 5;
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function Dashboard() {
  const { data, error, loading } = useAsync(
    () => Promise.all([fetchAllOrders(), fetchAllProducts()]),
    'dashboard',
  );

  // Loaded separately so a failure here never blanks the main dashboard.
  const attention = useAsync(async () => {
    const [reviews, messages, warranties] = await Promise.all([
      fetchAllReviews().catch(() => []),
      fetchContactMessages().catch(() => []),
      fetchWarranties().catch(() => []),
    ]);
    return {
      reviews: reviews.filter((review) => review.status === 'PENDING').length,
      messages: messages.filter((message) => message.status === 'NEW').length,
      warranties: warranties.filter((warranty) => warranty.status === 'PENDING').length,
    };
  }, 'dashboard-attention');

  const stats = useMemo(() => {
    if (!data) return null;
    const [orders, products] = data;

    const live = orders.filter((order) => order.status !== 'CANCELLED');
    const revenue = live.reduce((sum, order) => sum + order.total, 0);
    const pending = orders.filter((order) => order.status === 'PENDING');

    // Last seven days, oldest first, bucketed by local calendar day.
    const today = new Date();
    const week = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const key = day.toDateString();
      const dayOrders = live.filter((order) => new Date(order.createdAt).toDateString() === key);
      return {
        label: DAY_NAMES[day.getDay()] ?? '',
        sales: dayOrders.reduce((sum, order) => sum + order.total, 0),
        count: dayOrders.length,
      };
    });
    const peak = Math.max(1, ...week.map((day) => day.sales));

    const lowStock = products
      .filter((product) => product.isActive !== false && product.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock);

    return {
      revenue,
      orderCount: orders.length,
      pending,
      // Whole rupees — an average to the paisa is noise on a dashboard.
      average: live.length ? Math.round(revenue / live.length / 100) * 100 : 0,
      week,
      peak,
      lowStock,
      recent: orders.slice(0, 6),
      activeProducts: products.filter((product) => product.isActive !== false).length,
    };
  }, [data]);

  return (
    <div>
      <AdminPageHeader eyebrow="// OPERATIONS_OVERVIEW" title="Command" accent="Dashboard" />
      <AdminError message={error} />

      {loading || !stats ? (
        !error && <AdminSpinner />
      ) : (
        <div className="space-y-8">
          <AttentionPanel
            items={[
              { to: '/admin/orders', icon: Truck, label: 'Orders to confirm', count: stats.pending.length },
              { to: '/admin/reviews', icon: MessageSquareText, label: 'Reviews to approve', count: attention.data?.reviews ?? 0 },
              { to: '/admin/inbox', icon: Inbox, label: 'New messages', count: attention.data?.messages ?? 0 },
              { to: '/admin/inbox', icon: ShieldCheck, label: 'Warranty registrations', count: attention.data?.warranties ?? 0 },
            ]}
          />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatPrice(stats.revenue)} hint="Excluding cancelled" />
            <StatCard label="Orders" value={String(stats.orderCount)} hint="Most recent 500" />
            <StatCard
              label="Awaiting Action"
              value={String(stats.pending.length)}
              hint="Pending confirmation"
              tone={stats.pending.length > 0 ? 'warn' : 'default'}
            />
            <StatCard label="Avg. Order" value={formatPrice(stats.average)} />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            {/* Seven-day revenue */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
              <h2 className="mb-6 text-lg font-black tracking-tighter uppercase italic">
                Last 7 Days
              </h2>
              <div className="flex h-56 items-end gap-2 sm:gap-4">
                {stats.week.map((day, index) => (
                  <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="font-mono text-[9px] font-bold text-slate-400">
                      {day.count || ''}
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary"
                      style={{ height: `${Math.max(2, (day.sales / stats.peak) * 100)}%` }}
                      title={`${formatPrice(day.sales)} across ${day.count} orders`}
                    />
                    <span className="font-mono text-[10px] font-bold text-slate-500">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Low stock */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-black tracking-tighter uppercase italic">
                <PackageX size={18} className="text-amber-500" />
                Low Stock
              </h2>
              {stats.lowStock.length === 0 ? (
                <p className="text-sm font-medium text-slate-400">
                  Every active product has more than {LOW_STOCK_THRESHOLD} units.
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.lowStock.slice(0, 8).map((product) => (
                    <li key={product.id}>
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className="truncate text-sm font-bold text-slate-700">{product.name}</span>
                        <span
                          className={
                            product.stock === 0
                              ? 'shrink-0 font-mono text-xs font-black text-rose-500'
                              : 'shrink-0 font-mono text-xs font-black text-amber-600'
                          }
                        >
                          {product.stock === 0 ? 'OUT' : `${product.stock} left`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Recent orders */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tighter uppercase italic">Recent Orders</h2>
              <Link
                to="/admin/orders"
                className="flex items-center gap-2 text-xs font-black tracking-widest text-primary uppercase"
              >
                All orders <ArrowRight size={14} />
              </Link>
            </div>
            {stats.recent.length === 0 ? (
              <p className="text-sm font-medium text-slate-400">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recent.map((order) => (
                  <li key={order.id}>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-slate-50 sm:px-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-black text-primary">{order.manifestId}</p>
                        <p className="truncate text-xs font-medium text-slate-500">
                          {order.fullName} · {order.city} · {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black">{formatPrice(order.total)}</span>
                        <StatusBadge status={order.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AttentionPanel({
  items,
}: {
  items: Array<{ to: string; icon: typeof Truck; label: string; count: number }>;
}) {
  const waiting = items.filter((item) => item.count > 0);
  if (waiting.length === 0) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
        Nothing needs attention — all orders, reviews and messages are handled.
      </p>
    );
  }
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="mb-3 text-xs font-black tracking-widest text-amber-800 uppercase">Needs attention</h2>
      <div className="flex flex-wrap gap-3">
        {waiting.map(({ to, icon: Icon, label, count }) => (
          <Link
            key={label}
            to={to}
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-amber-400"
          >
            <Icon size={16} className="text-amber-600" />
            {label}
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
