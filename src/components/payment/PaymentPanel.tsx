import { CheckCircle2, Clock, Smartphone, TriangleAlert, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { validateWallet, WalletFields, type WalletDetails, type WalletErrors } from '@/components/payment/WalletFields';
import { formatPrice } from '@/lib/money';
import { cn, formatDateTime } from '@/lib/utils';
import type { OrderDoc } from '@/services/orders';
import {
  fetchWalletConfig,
  PaymentStartError,
  startWalletPayment,
  WALLET_LABELS,
  type WalletConfig,
  type WalletProvider,
} from '@/services/payments';

/**
 * The payment state of a JazzCash / Easypaisa order, kept live by the order
 * page's Firestore subscription: pay or retry, "approve on your phone", paid,
 * or expired. Renders nothing for Cash on Delivery.
 */
export function PaymentPanel({ order, initialError = '' }: { order: OrderDoc; initialError?: string }) {
  const provider = order.paymentMethod === 'JAZZCASH' || order.paymentMethod === 'EASYPAISA' ? order.paymentMethod : null;

  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [wallet, setWallet] = useState<WalletDetails>({ mobileNumber: order.phone ?? '', cnicLast6: '' });
  const [errors, setErrors] = useState<WalletErrors>({});
  const [startError, setStartError] = useState(initialError);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchWalletConfig().then((result) => {
      if (active) setConfig(result);
    });
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!provider) return null;
  const label = WALLET_LABELS[provider];
  const status = order.paymentStatus ?? 'UNPAID';

  if (status === 'PAID') {
    return (
      <Card tone="emerald" icon={CheckCircle2} title={`Paid with ${label}`}>
        <p>
          {formatPrice(order.total)} received{order.paidAt ? ` on ${formatDateTime(order.paidAt)}` : ''}
          {order.paymentWallet ? ` from ${order.paymentWallet}` : ''}.
        </p>
        {order.paymentRef && <p className="font-mono text-xs">Reference: {order.paymentRef}</p>}
      </Card>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <Card tone="blue" icon={Smartphone} title="Approve the payment on your phone" busy>
        <p>{order.paymentMessage ?? `Open your ${label} app and approve the payment.`}</p>
        <p className="text-xs">
          Waiting for {label} to confirm {formatPrice(order.total)}
          {order.paymentWallet ? ` from ${order.paymentWallet}` : ''}. This page updates by itself — keep it open.
        </p>
      </Card>
    );
  }

  if (status === 'REVIEW') {
    return (
      <Card tone="amber" icon={Clock} title="We're confirming your payment">
        <p>{order.paymentMessage ?? 'Our team is checking this payment. Please do not pay again.'}</p>
        <p className="text-xs">
          If money left your account, it is safe — we will confirm with {label} and contact you on {order.phone}.
        </p>
      </Card>
    );
  }

  if (status === 'EXPIRED' || order.status === 'CANCELLED') {
    return (
      <Card tone="slate" icon={XCircle} title="This order was not paid">
        <p>{order.paymentMessage ?? 'The order was cancelled before payment was completed.'}</p>
        <Link to="/shop" className="text-sm font-black text-primary underline">
          Continue shopping
        </Link>
      </Card>
    );
  }

  // UNPAID or FAILED, still payable.
  const windowMinutes = config?.paymentWindowMinutes ?? 30;
  const deadline = new Date(order.createdAt).getTime() + windowMinutes * 60_000;
  const minutesLeft = Math.max(0, Math.ceil((deadline - now) / 60_000));
  const available = config === null || config.providers.includes(provider);

  const pay = async () => {
    const found = validateWallet(provider, wallet);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStarting(true);
    setStartError('');
    try {
      await startWalletPayment({
        orderId: order.id,
        provider: provider as WalletProvider,
        mobileNumber: wallet.mobileNumber,
        ...(provider === 'JAZZCASH' ? { cnicLast6: wallet.cnicLast6.trim() } : {}),
      });
      // The order subscription flips this panel to "approve on your phone".
    } catch (error) {
      setStartError(error instanceof PaymentStartError ? error.message : 'Could not start the payment. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card
      tone={status === 'FAILED' ? 'rose' : 'blue'}
      icon={status === 'FAILED' ? TriangleAlert : Smartphone}
      title={status === 'FAILED' ? 'Payment did not go through' : `Pay ${formatPrice(order.total)} with ${label}`}
    >
      {status === 'FAILED' && order.paymentMessage && <p className="font-bold">{order.paymentMessage}</p>}
      <p>
        {minutesLeft > 0
          ? `Your items are reserved. Complete payment within ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}, or the order is cancelled automatically.`
          : 'The time to pay has passed; this order is being cancelled.'}
      </p>

      {minutesLeft > 0 && !available && (
        <p className="font-bold">{label} payments are temporarily unavailable. Please try again shortly or contact us.</p>
      )}

      {minutesLeft > 0 && available && (
        <div className="space-y-4 rounded-2xl bg-white p-4 text-slate-700">
          <WalletFields provider={provider} value={wallet} errors={errors} onChange={setWallet} idPrefix="pay" />
          {startError && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">
              {startError}
            </p>
          )}
          <button type="button" onClick={() => void pay()} disabled={starting} className="primary-btn w-full py-4">
            {starting ? 'Starting…' : status === 'FAILED' ? `Try again with ${label}` : `Pay ${formatPrice(order.total)} with ${label}`}
          </button>
          <p className="text-center text-xs text-slate-400">
            You'll get a prompt from {label} on your phone to approve the payment.
          </p>
        </div>
      )}
    </Card>
  );
}

const TONES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
} as const;

function Card({
  tone,
  icon: Icon,
  title,
  busy = false,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof CheckCircle2;
  title: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-live="polite" data-testid="payment-panel" className={cn('space-y-3 rounded-3xl border p-6 text-left md:p-8', TONES[tone])}>
      <h2 className="flex items-center gap-3 text-lg font-black tracking-tight">
        <Icon size={22} className={cn('shrink-0', busy && 'animate-pulse')} />
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
