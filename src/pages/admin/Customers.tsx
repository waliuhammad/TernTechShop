import { Ban, Search, ShieldCheck, ShieldOff, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AdminError,
  AdminPageHeader,
  AdminSpinner,
  TableShell,
  tdClass,
  thClass,
} from '@/components/admin/AdminUI';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { formatPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  fetchAllOrders,
  fetchCustomers,
  grantStaff,
  reinstateCustomer,
  revokeStaff,
  suspendCustomer,
  type CustomerRow,
} from '@/services/admin';

const ROLE_STYLES = {
  ADMIN: 'bg-primary/10 text-primary',
  STAFF: 'bg-violet-50 text-violet-700',
  CUSTOMER: 'bg-slate-100 text-slate-500',
} as const;

type View = 'all' | 'staff' | 'suspended';

export default function AdminCustomers() {
  const { user, isAdmin } = useAuth();
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([fetchCustomers(), fetchAllOrders()]),
    'admin-customers',
  );

  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<CustomerRow | null>(null);
  const [reason, setReason] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    const [customers, orders] = data;

    const spend = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      const entry = spend.get(order.userId) ?? { count: 0, total: 0 };
      entry.count += 1;
      if (order.status !== 'CANCELLED') entry.total += order.total;
      spend.set(order.userId, entry);
    }

    const term = search.trim().toLowerCase();
    return customers
      .map((customer) => ({ ...customer, ...(spend.get(customer.uid) ?? { count: 0, total: 0 }) }))
      .filter((customer) => {
        if (view === 'staff' && customer.role === 'CUSTOMER') return false;
        if (view === 'suspended' && !customer.suspended) return false;
        if (!term) return true;
        return [customer.name, customer.email, customer.phone, customer.city]
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
  }, [data, search, view]);

  const run = async (uid: string, action: () => Promise<void>, success: string) => {
    setBusyUid(uid);
    try {
      await action();
      notify(success);
      reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const confirmSuspend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!suspending || !user) return;
    const target = suspending;
    setSuspending(null);
    await run(
      target.uid,
      () => suspendCustomer(target.uid, reason, user.uid),
      `${target.name || target.email} suspended — they can no longer sign in or order.`,
    );
    setReason('');
  };

  const views: Array<{ key: View; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'staff', label: 'Staff & admins' },
    { key: 'suspended', label: 'Suspended' },
  ];

  return (
    <div>
      <AdminPageHeader eyebrow="// OPERATOR_REGISTRY" title="Customer" accent="Accounts" />
      <AdminError message={error} />

      {suspending && (
        <form
          onSubmit={(event) => void confirmSuspend(event)}
          className="mb-6 space-y-4 rounded-2xl border border-rose-200 bg-white p-6"
        >
          <h2 className="text-sm font-black tracking-widest text-rose-700 uppercase">
            Suspend {suspending.name || suspending.email}
          </h2>
          <p className="text-sm text-slate-500">
            They'll be signed out and told their account is suspended. Adding to cart, checkout and
            reviews are also refused by the database. You can reinstate them at any time.
          </p>
          <label className="block space-y-1.5">
            <span className="terminal-label text-slate-500">Reason (internal, optional)</span>
            <input
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. repeated fake COD orders"
              className="field-input"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
            >
              Suspend account
            </button>
            <button
              type="button"
              onClick={() => setSuspending(null)}
              className="secondary-btn px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {views.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                'cursor-pointer rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors',
                view === key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, phone, city…"
            className="field-input pl-11"
          />
        </div>
      </div>

      {!isAdmin && (
        <p className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-500">
          Granting staff access and suspending accounts requires the ADMIN role.
        </p>
      )}

      {loading ? (
        <AdminSpinner />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-medium text-slate-400">
          {data?.[0].length ? 'No accounts match.' : 'No registered customers yet.'}
        </p>
      ) : (
        <TableShell>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Contact</th>
                <th className={cn(thClass, 'text-right')}>Orders</th>
                <th className={cn(thClass, 'text-right')}>Lifetime spend</th>
                <th className={thClass}>Role</th>
                {isAdmin && <th className={cn(thClass, 'text-right')}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((customer) => {
                const isSelf = customer.uid === user?.uid;
                const busy = busyUid === customer.uid;
                return (
                  <tr key={customer.uid} className={cn(customer.suspended && 'bg-rose-50/40')}>
                    <td className={tdClass}>
                      <p className="font-bold text-slate-900">
                        {customer.name || '—'}
                        {isSelf && <span className="ml-2 text-xs font-medium text-slate-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-400">{customer.email}</p>
                      {customer.suspended && (
                        <p className="mt-1 text-xs font-bold text-rose-600">
                          Suspended{customer.suspensionReason && ` — ${customer.suspensionReason}`}
                        </p>
                      )}
                    </td>
                    <td className={tdClass}>
                      <p className="font-mono text-slate-600">{customer.phone || '—'}</p>
                      <p className="text-xs text-slate-400">{customer.city}</p>
                    </td>
                    <td className={cn(tdClass, 'text-right font-bold')}>{customer.count}</td>
                    <td className={cn(tdClass, 'text-right font-black whitespace-nowrap')}>
                      {formatPrice(customer.total)}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase',
                          ROLE_STYLES[customer.role],
                        )}
                      >
                        {customer.role}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className={cn(tdClass, 'text-right whitespace-nowrap')}>
                        {isSelf || customer.role === 'ADMIN' ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : customer.role === 'STAFF' ? (
                          <ActionButton
                            icon={ShieldOff}
                            label="Remove staff"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Remove staff access from ${customer.email}?`)) return;
                              void run(customer.uid, () => revokeStaff(customer.uid), `${customer.email} is no longer staff.`);
                            }}
                          />
                        ) : customer.suspended ? (
                          <ActionButton
                            icon={UserCheck}
                            label="Reinstate"
                            tone="positive"
                            disabled={busy}
                            onClick={() =>
                              void run(customer.uid, () => reinstateCustomer(customer.uid), `${customer.email} can shop again.`)
                            }
                          />
                        ) : (
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              icon={ShieldCheck}
                              label="Make staff"
                              disabled={busy}
                              onClick={() => {
                                if (!user) return;
                                if (
                                  !window.confirm(
                                    `Give ${customer.email} staff access? They'll be able to manage orders, products and stock.`,
                                  )
                                )
                                  return;
                                void run(customer.uid, () => grantStaff(customer.uid, user.uid), `${customer.email} is now staff. They need to sign out and back in.`);
                              }}
                            />
                            <ActionButton
                              icon={Ban}
                              label="Suspend"
                              tone="danger"
                              disabled={busy}
                              onClick={() => {
                                setReason('');
                                setSuspending(customer);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <p className="mt-6 text-xs leading-relaxed font-medium text-slate-400">
        Staff can manage orders, products and stock. Only an ADMIN can create coupons, delete
        products, grant staff or suspend accounts. New ADMINs are created with{' '}
        <code className="font-mono whitespace-nowrap">npm run seed -- --admin UID</code>, never from the website.
      </p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: typeof Ban;
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: 'default' | 'danger' | 'positive';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger' && 'border-rose-200 text-rose-600 hover:bg-rose-50',
        tone === 'positive' && 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
        tone === 'default' && 'border-slate-200 text-slate-600 hover:bg-slate-50',
      )}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
