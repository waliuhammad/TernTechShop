import { ArrowLeft, MessageCircle, PackageCheck, PackageOpen, Phone, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminError, AdminSpinner, StatusBadge } from '@/components/admin/AdminUI';
import { PaymentBadge } from '@/components/payment/PaymentBadge';
import { useToast } from '@/context/ToastContext';
import { adminErrorMessage, useAsync } from '@/hooks/useAsync';
import { formatPrice } from '@/lib/money';
import { cn, formatDateTime } from '@/lib/utils';
import {
  fetchOrder,
  InsufficientStockError,
  NEXT_STATUSES,
  saveOrderNote,
  updateOrderStatus,
  type OrderStatus,
} from '@/services/admin';
import { fetchPaymentAttempts, PAYMENT_METHOD_LABELS, WALLET_LABELS } from '@/services/payments';

/** 0316 4587553 -> 923164587553, for a wa.me link. */
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

const ACTION_STYLES: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'bg-blue-600 hover:bg-blue-700 text-white',
  PROCESSING: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  SHIPPED: 'bg-violet-600 hover:bg-violet-700 text-white',
  DELIVERED: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  CANCELLED: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
};

export default function AdminOrderDetail() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { notify } = useToast();
  const { data: order, error, loading, reload } = useAsync(() => fetchOrder(orderId), `order-${orderId}`);
  const attempts = useAsync(() => fetchPaymentAttempts(orderId), `payments-${orderId}`);

  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading) return <AdminSpinner />;

  if (!order) {
    return (
      <div className="space-y-4">
        <AdminError message={error || 'Order not found.'} />
        <Link to="/admin/orders" className="secondary-btn inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to orders
        </Link>
      </div>
    );
  }

  const status = order.status as OrderStatus;
  const noteValue = note ?? order.adminNote ?? '';
  const actions = NEXT_STATUSES[status] ?? [];

  const online = order.paymentMethod === 'JAZZCASH' || order.paymentMethod === 'EASYPAISA';
  const walletName = online ? WALLET_LABELS[order.paymentMethod as 'JAZZCASH' | 'EASYPAISA'] : '';
  const paid = order.paymentStatus === 'PAID';

  const transition = async (next: OrderStatus) => {
    const refundNote = online && (paid || order.paymentStatus === 'REVIEW')
      ? ` The customer paid by ${walletName}: refund them from the ${walletName} merchant portal.`
      : '';
    if (next === 'CANCELLED' && !window.confirm(`Cancel ${order.manifestId}?${order.stockDeducted ? ' Its units will be returned to stock.' : ''}${refundNote}`)) {
      return;
    }
    if (next === 'CONFIRMED' && online && !paid && !window.confirm(`${order.manifestId} has not been paid by ${walletName} yet. Confirm it anyway?`)) {
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await updateOrderStatus(order.id, next, noteValue);
      notify(`${order.manifestId} marked ${next}.`);
      setNote(null);
      reload();
    } catch (caught) {
      const message =
        caught instanceof InsufficientStockError ? caught.message : adminErrorMessage(caught);
      setActionError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await saveOrderNote(order.id, noteValue);
      notify('Note saved.');
      setNote(null);
      reload();
    } catch (caught) {
      notify(adminErrorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-slate-400 uppercase hover:text-primary"
      >
        <ArrowLeft size={14} /> All orders
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
            Placed {formatDateTime(order.createdAt)} · {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
          </p>
          <h1 className="font-mono text-3xl font-black tracking-widest text-primary md:text-4xl">
            {order.manifestId}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase',
              order.stockDeducted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
            )}
            title="Stock is taken when the customer places the order, and returned if it is cancelled."
          >
            {order.stockDeducted ? <PackageCheck size={12} /> : <PackageOpen size={12} />}
            {order.stockDeducted ? 'Stock deducted' : 'Stock not deducted'}
          </span>
          <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
          <StatusBadge status={order.status} />
        </div>
      </div>

      {order.paymentStatus === 'REVIEW' && (
        <p className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          This {walletName} payment needs checking. Look up the references below in the {walletName} merchant
          portal, then confirm the order or refund the customer.
        </p>
      )}

      <AdminError message={actionError} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Lines */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-black tracking-tighter uppercase italic">Cargo Manifest</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-4 py-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-grow">
                    <Link
                      to={`/admin/products/${item.productId}`}
                      className="block truncate text-sm font-bold text-slate-900 hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="font-mono text-[10px] text-slate-400 uppercase">
                      {item.sku} · {formatPrice(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black">{formatPrice(item.lineTotal)}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-bold">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
                  <dd className="font-bold">-{formatPrice(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Logistics</dt>
                <dd className="font-bold">{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
                <dt className="font-black">{online ? (paid ? `Paid by ${walletName}` : `Due by ${walletName}`) : 'Collect on delivery'}</dt>
                <dd className="font-black">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* Status */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-black tracking-tighter uppercase italic">Lifecycle</h2>

            {actions.length === 0 ? (
              <p className="text-sm font-medium text-slate-400">
                This order is {order.status.toLowerCase()} — no further transitions.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {actions.map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={busy}
                    onClick={() => void transition(next)}
                    className={cn(
                      'cursor-pointer rounded-xl px-5 py-3 text-xs font-black tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      ACTION_STYLES[next],
                    )}
                  >
                    {next === 'CANCELLED' ? 'Cancel order' : `Mark ${next.toLowerCase()}`}
                  </button>
                ))}
              </div>
            )}

            {status === 'PENDING' && (
              <p className="text-xs leading-relaxed font-medium text-slate-400">
                {order.stockDeducted
                  ? 'Stock for this order is already reserved. Cancelling returns it to stock.'
                  : 'Placed before stock reservation: confirming deducts each line from stock, and is refused if a product has sold out.'}
              </p>
            )}

            <div className="space-y-2 pt-2">
              <label htmlFor="note" className="terminal-label text-slate-500">
                Internal note (not shown to customer)
              </label>
              <textarea
                id="note"
                rows={3}
                value={noteValue}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Confirmed by phone, courier tracking number…"
                className="field-input resize-none"
              />
              {note !== null && note !== (order.adminNote ?? '') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveNote()}
                  className="tech-btn px-5 py-2 text-xs"
                >
                  Save note
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Consignee */}
        <aside className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-black tracking-tighter uppercase italic">Consignee</h2>
            <div className="space-y-1 text-sm">
              <p className="font-black text-slate-900">{order.fullName}</p>
              <p className="text-slate-600">{order.email}</p>
              <p className="font-mono text-slate-600">{order.phone}</p>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}
                className="secondary-btn flex items-center justify-center gap-2 py-2.5 text-sm"
              >
                <Phone size={14} /> Call
              </a>
              <a
                href={`https://wa.me/${whatsappNumber(order.phone)}?text=${encodeURIComponent(
                  `Assalam o Alaikum ${order.fullName}, this is Tern Technologies about your order ${order.manifestId} (${formatPrice(order.total)}).`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          </section>

          {online && (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-black tracking-tighter uppercase italic">Payment</h2>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Method</dt>
                  <dd className="font-bold">{walletName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Status</dt>
                  <dd><PaymentBadge method={order.paymentMethod} status={order.paymentStatus} /></dd>
                </div>
                {order.paymentWallet && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Wallet</dt>
                    <dd className="font-mono">{order.paymentWallet}</dd>
                  </div>
                )}
                {order.paymentRef && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Reference</dt>
                    <dd className="font-mono break-all">{order.paymentRef}</dd>
                  </div>
                )}
                {order.paidAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Paid</dt>
                    <dd>{formatDateTime(order.paidAt)}</dd>
                  </div>
                )}
              </dl>
              {order.paymentMessage && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{order.paymentMessage}</p>}

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h3 className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">Attempts</h3>
                {attempts.loading ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : (attempts.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-slate-400">No payment attempted yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {attempts.data?.map((attempt) => (
                      <li key={attempt.txnRef} className="rounded-xl border border-slate-100 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold">{attempt.txnRef}</span>
                          <span className="font-black">{attempt.status}</span>
                        </div>
                        <p className="text-slate-500">
                          {attempt.createdAt && formatDateTime(attempt.createdAt)} · {attempt.wallet}
                          {attempt.code ? ` · code ${attempt.code}` : ''}
                          {attempt.providerRef ? ` · ref ${attempt.providerRef}` : ''}
                        </p>
                        {attempt.message && <p className="text-slate-600">{attempt.message}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Transaction references match the “Txn Ref” in the {walletName} merchant portal. Refunds are made
                  there.
                </p>
              </div>
            </section>
          )}

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-black tracking-tighter uppercase italic">Destination</h2>
            <p className="text-sm leading-relaxed text-slate-700">{order.address}</p>
            <p className="text-sm font-bold text-slate-900">{order.city}</p>
            {order.notes && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 italic">
                “{order.notes}”
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
