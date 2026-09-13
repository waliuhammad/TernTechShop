import { collection, getDocs, query, where } from 'firebase/firestore';
import { getAuthOrThrow, getDbOrThrow } from '@/lib/firebase';

/**
 * JazzCash and Easypaisa mobile-wallet payments.
 *
 * The browser never talks to the gateways and never holds a merchant secret.
 * It asks the payment server (server/ in this repo, hosted at
 * VITE_PAYMENTS_API_URL) to charge one of the customer's own orders; the
 * server works out the amount from the order, calls the gateway, and writes
 * the result back to the order, which the order page watches live.
 *
 * With VITE_PAYMENTS_API_URL unset, or the server unreachable, checkout simply
 * offers Cash on Delivery only.
 */

export type WalletProvider = 'JAZZCASH' | 'EASYPAISA';
export type PaymentMethod = 'COD' | WalletProvider;

export type PaymentStatus = 'UNPAID' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REVIEW' | 'EXPIRED';

export const WALLET_LABELS: Record<WalletProvider, string> = {
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: 'Cash on Delivery',
  ...WALLET_LABELS,
};

const API_URL = ((import.meta.env.VITE_PAYMENTS_API_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

export const isPaymentsConfigured = Boolean(API_URL);

export interface WalletConfig {
  providers: WalletProvider[];
  paymentWindowMinutes: number;
}

const NO_WALLETS: WalletConfig = { providers: [], paymentWindowMinutes: 30 };

let cached: Promise<WalletConfig> | null = null;

/** Which wallets the server has credentials for. Never rejects. */
export function fetchWalletConfig(): Promise<WalletConfig> {
  if (!API_URL) return Promise.resolve(NO_WALLETS);
  cached ??= fetch(`${API_URL}/api/payments/config`, { signal: AbortSignal.timeout(8000) })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as Partial<WalletConfig>;
      return {
        providers: (body.providers ?? []).filter((p): p is WalletProvider => p === 'JAZZCASH' || p === 'EASYPAISA'),
        paymentWindowMinutes: Number(body.paymentWindowMinutes) || 30,
      };
    })
    .catch((error: unknown) => {
      console.warn('Payment service unavailable; offering Cash on Delivery only.', error);
      cached = null; // try again next time
      return NO_WALLETS;
    });
  return cached;
}

/** "+92 300-1234567" / "923001234567" / "03001234567" -> "03001234567", or null. */
export function normaliseWalletNumber(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  const local = digits.replace(/^\+?92(?=3\d{9}$)/, '0');
  return /^03\d{9}$/.test(local) ? local : null;
}

export class PaymentStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentStartError';
  }
}

export interface StartWalletPaymentInput {
  orderId: string;
  provider: WalletProvider;
  mobileNumber: string;
  /** JazzCash only. Sent to the server for this one request; never stored. */
  cnicLast6?: string;
}

/**
 * Asks the server to charge the order. Resolves as soon as the payment has
 * started — the result arrives on the order document, not here.
 */
export async function startWalletPayment(input: StartWalletPaymentInput): Promise<void> {
  if (!API_URL) throw new PaymentStartError('Online payment is not available right now.');
  const user = getAuthOrThrow().currentUser;
  if (!user) throw new PaymentStartError('Sign in to pay.');

  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/payments/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PaymentStartError('Could not reach the payment service. Check your connection and try again.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new PaymentStartError(body.error ?? 'Could not start the payment. Please try again.');
  }
}

export interface PaymentAttempt {
  txnRef: string;
  provider: WalletProvider;
  amount: number;
  wallet: string;
  status: string;
  code?: string;
  message?: string;
  providerRef?: string;
  createdAt: string;
}

/** Staff only (rules): every attempt for an order, newest first. */
export async function fetchPaymentAttempts(orderId: string): Promise<PaymentAttempt[]> {
  const snapshot = await getDocs(query(collection(getDbOrThrow(), 'payments'), where('orderId', '==', orderId)));
  return snapshot.docs
    .map((snap) => {
      const data = snap.data();
      const created = data.createdAt as { toDate?: () => Date } | undefined;
      return {
        txnRef: snap.id,
        provider: data.provider as WalletProvider,
        amount: Number(data.amount ?? 0),
        wallet: String(data.wallet ?? ''),
        status: String(data.status ?? ''),
        code: data.code as string | undefined,
        message: data.message as string | undefined,
        providerRef: data.providerRef as string | undefined,
        createdAt: created?.toDate ? created.toDate().toISOString() : '',
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
