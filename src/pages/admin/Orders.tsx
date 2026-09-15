import { RotateCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PaymentBadge } from '@/components/payment/PaymentBadge';
import {
  AdminError,
  AdminPageHeader,
  AdminSpinner,
  StatusBadge,
  TableShell,
  tdClass,
  thClass,
} from '@/components/admin/AdminUI';
import { useAsync } from '@/hooks/useAsync';
import { formatPrice } from '@/lib/money';
import { cn, formatDateTime } from '@/lib/utils';
import { fetchAllOrders, ORDER_STATUSES } from '@/services/admin';

type Filter = 'ALL' | (typeof ORDER_STATUSES)[number];

export default function AdminOrders() {
  const navigate = useNavigate();
  const { data: orders, error, loading, reload } = useAsync(() => fetchAllOrders(), 'admin-orders');

  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (orders ?? []).forEach((order) => map.set(order.status, (map.get(order.status) ?? 0) + 1));
    return map;
  }, [orders]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      if (filter !== 'ALL' && order.status !== filter) return false;
      if (!term) return true;
      return [order.manifestId, order.fullName, order.phone, order.email, order.city]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [orders, filter, search]);

  return (
    <div>
      <AdminPageHeader eyebrow="// DEPLOYMENT_QUEUE" title="Order" accent="Manifests">
        <button
          type="button"
          onClick={reload}
          className="secondary-btn flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RotateCw size={14} />
          Refresh
        </button>
      </AdminPageHeader>

      <AdminError message={error} />

      <div className="mb-6 space-y-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {(['ALL', ...ORDER_STATUSES] as Filter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={cn(
                'shrink-0 cursor-pointer rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors',
                filter === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400',
              )}
            >
              {status}{' '}
              <span className="opacity-60">
                {status === 'ALL' ? (orders?.length ?? 0) : (counts.get(status) ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Manifest ID, name, phone, email, city…"
            className="field-input pl-11"
          />
        </div>
      </div>

      {loading ? (
        <AdminSpinner />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          {orders?.length ? 'No orders match these filters.' : 'No orders yet.'}
        </p>
      ) : (
        <TableShell>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thClass}>Manifest</th>
                <th className={thClass}>Placed</th>
                <th className={thClass}>Consignee</th>
                <th className={thClass}>City</th>
                <th className={thClass}>Lines</th>
                <th className={cn(thClass, 'text-right')}>Total</th>
                <th className={thClass}>Payment</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className={cn(tdClass, 'font-mono font-black text-primary')}>{order.manifestId}</td>
                  <td className={cn(tdClass, 'whitespace-nowrap text-slate-500')}>
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className={tdClass}>
                    <p className="font-bold text-slate-900">
                      {order.fullName}
                      {order.guestCheckout && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 align-middle font-mono text-[9px] font-bold tracking-widest text-slate-500 uppercase">
                        Guest
                      </span>
                    )}
                    </p>
                    <p className="font-mono text-xs text-slate-400">{order.phone}</p>
                  </td>
                  <td className={cn(tdClass, 'text-slate-600')}>{order.city}</td>
                  <td className={cn(tdClass, 'text-slate-600')}>{order.items.length}</td>
                  <td className={cn(tdClass, 'text-right font-black whitespace-nowrap')}>
                    {formatPrice(order.total)}
                  </td>
                  <td className={tdClass}>
                    <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
                  </td>
                  <td className={tdClass}>
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
