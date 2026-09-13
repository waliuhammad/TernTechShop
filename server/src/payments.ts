import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { config, type Provider } from './config.js';
import { db } from './firebase.js';
import { createEasypaisa } from './gateways/easypaisa.js';
import { createJazzCash } from './gateways/jazzcash.js';
import type { GatewayResult, WalletGateway } from './gateways/types.js';
import { karachiStamp } from './time.js';

/**
 * Wallet payments for orders the storefront has already placed.
 *
 * The order (and its stock reservation) is created by the customer's browser
 * and validated by firestore.rules, starting as paymentStatus UNPAID. This
 * module is the only thing that can move it on:
 *
 *   UNPAID/FAILED --start--> PROCESSING --gateway--> PAID | FAILED
 *                                            \--unsure--> (inquiry) --> PAID | FAILED | REVIEW
 *   UNPAID/FAILED --window passes--> EXPIRED (order cancelled, stock returned)
 *
 * Every attempt is logged in payments/{txnRef}. The amount always comes from
 * the order document, never from the request.
 */

export class PaymentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

interface OrderData {
  userId: string;
  manifestId: string;
  status: string;
  paymentMethod: string;
  paymentStatus?: string;
  paymentTxnRef?: string;
  paymentAttempts?: number;
  total: number;
  email?: string;
  createdAt?: Timestamp;
  stockDeducted?: boolean;
  adminNote?: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface PaymentData {
  orderId: string;
  userId: string;
  provider: Provider;
  amount: number;
  status: 'PROCESSING' | 'PENDING' | 'PAID' | 'FAILED' | 'REVIEW';
  createdAt: Timestamp;
}

const gateways: Partial<Record<Provider, WalletGateway>> = {
  ...(config.jazzcash ? { JAZZCASH: createJazzCash(config.jazzcash, config.gatewayTimeoutMs) } : {}),
  ...(config.easypaisa ? { EASYPAISA: createEasypaisa(config.easypaisa, config.gatewayTimeoutMs) } : {}),
};

/** Attempts whose gateway call is running in this process right now. */
const inFlight = new Set<string>();

const PROVIDER_NAME: Record<Provider, string> = { JAZZCASH: 'JazzCash', EASYPAISA: 'Easypaisa' };

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** "+92 300-1234567" / "923001234567" / "03001234567" -> "03001234567", or null. */
export function normaliseMobile(input: unknown): string | null {
  const digits = String(input ?? '').replace(/[\s-]/g, '');
  const local = digits.replace(/^\+?92(?=3\d{9}$)/, '0');
  return /^03\d{9}$/.test(local) ? local : null;
}

export function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 4)}****${mobile.slice(-3)}`;
}

/** ≤ 20 alphanumeric characters, unique per attempt: T + yyyyMMddHHmmss + 5 random. */
export function newTxnRef(now = new Date()): string {
  const random = randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
  return `T${karachiStamp(now)}${random}`;
}

function windowEndsAt(order: OrderData): Date {
  const created = order.createdAt?.toDate() ?? new Date();
  return new Date(created.getTime() + config.paymentWindowMinutes * 60_000);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export interface StartInput {
  uid: string;
  orderId: unknown;
  provider: unknown;
  mobileNumber: unknown;
  cnicLast6?: unknown;
}

export async function startPayment(input: StartInput): Promise<{ txnRef: string }> {
  const provider = input.provider === 'JAZZCASH' || input.provider === 'EASYPAISA' ? input.provider : null;
  if (!provider) throw new PaymentError(400, 'Unknown payment method.');
  const gateway = gateways[provider];
  if (!gateway) throw new PaymentError(503, `${PROVIDER_NAME[provider]} payments are not available right now.`);

  const orderId = typeof input.orderId === 'string' && /^[A-Za-z0-9]{10,40}$/.test(input.orderId) ? input.orderId : null;
  if (!orderId) throw new PaymentError(400, 'Invalid order.');

  const mobileNumber = normaliseMobile(input.mobileNumber);
  if (!mobileNumber) throw new PaymentError(400, 'Enter a valid mobile number, e.g. 03001234567.');

  const cnicLast6 = String(input.cnicLast6 ?? '').trim();
  if (provider === 'JAZZCASH' && !/^\d{6}$/.test(cnicLast6)) {
    throw new PaymentError(400, 'Enter the last 6 digits of the CNIC registered with your JazzCash account.');
  }

  const suspended = await db.doc(`suspensions/${input.uid}`).get();
  if (suspended.exists) throw new PaymentError(403, 'This account is suspended.');

  const orderRef = db.doc(`orders/${orderId}`) as DocumentReference<OrderData>;
  const txnRef = newTxnRef();

  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    const data = snap.data();
    // Same message whether it doesn't exist or isn't theirs: don't confirm order ids.
    if (!data || data.userId !== input.uid) throw new PaymentError(404, 'Order not found.');
    if (data.paymentMethod !== provider) throw new PaymentError(409, `This order is set to be paid by ${data.paymentMethod}.`);
    if (data.paymentStatus === 'PAID') throw new PaymentError(409, 'This order is already paid.');
    if (data.paymentStatus === 'PROCESSING') throw new PaymentError(409, 'A payment for this order is already in progress. Check your phone.');
    if (data.paymentStatus === 'REVIEW') throw new PaymentError(409, 'We are confirming an earlier payment for this order. Please do not pay again.');
    if (data.status !== 'PENDING' || !['UNPAID', 'FAILED'].includes(data.paymentStatus ?? '')) {
      throw new PaymentError(409, 'This order can no longer be paid.');
    }
    if (Date.now() > windowEndsAt(data).getTime()) throw new PaymentError(409, 'The time to pay for this order has passed.');
    if ((data.paymentAttempts ?? 0) >= config.maxAttemptsPerOrder) {
      throw new PaymentError(429, 'Too many payment attempts for this order. Please contact us.');
    }

    tx.update(orderRef, {
      paymentStatus: 'PROCESSING',
      paymentTxnRef: txnRef,
      paymentAttempts: FieldValue.increment(1),
      paymentWallet: maskMobile(mobileNumber),
      paymentMessage: `Approve the payment in your ${PROVIDER_NAME[provider]} app or on your phone.`,
      paymentUpdatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(db.doc(`payments/${txnRef}`), {
      orderId,
      manifestId: data.manifestId,
      userId: input.uid,
      provider,
      amount: data.total,
      wallet: maskMobile(mobileNumber),
      status: 'PROCESSING',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return data;
  });

  console.info(`[payment] ${txnRef} started: ${provider} order ${orderId} amount ${order.total}`);

  // The gateway waits while the customer approves on their phone, which can
  // take a minute. Answer the browser now; it watches the order for the result.
  inFlight.add(txnRef);
  void gateway
    .pay({
      txnRef,
      amount: order.total,
      mobileNumber,
      ...(provider === 'JAZZCASH' ? { cnicLast6 } : {}),
      manifestId: order.manifestId,
      email: order.email ?? '',
      expiresAt: windowEndsAt(order),
    })
    .then((result) => applyResult(txnRef, result))
    .catch((error: unknown) => console.error(`[payment] ${txnRef} gateway call crashed:`, error))
    .finally(() => inFlight.delete(txnRef));

  return { txnRef };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function applyResult(txnRef: string, result: GatewayResult): Promise<void> {
  const paymentRef = db.doc(`payments/${txnRef}`) as DocumentReference<PaymentData>;

  await db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    const payment = paymentSnap.data();
    if (!payment) return;
    // Final answers are final; a late duplicate changes nothing.
    if (payment.status === 'PAID' || payment.status === 'FAILED') return;

    const orderRef = db.doc(`orders/${payment.orderId}`) as DocumentReference<OrderData>;
    const order = (await tx.get(orderRef)).data();

    const stillPending = result.outcome === 'PENDING';
    const tooOld = Date.now() - payment.createdAt.toMillis() > config.reviewAfterMinutes * 60_000;
    const outcome = stillPending && tooOld ? 'REVIEW' : result.outcome;

    tx.update(paymentRef, {
      status: outcome === 'PENDING' ? 'PENDING' : outcome,
      code: result.code,
      message: result.message,
      ...(result.providerRef ? { providerRef: result.providerRef } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!order) return;
    const current = order.paymentTxnRef === txnRef;
    updateOrderForOutcome(tx, orderRef, order, outcome, result, current, payment.provider);
  });

  console.info(`[payment] ${txnRef} -> ${result.outcome} (${result.code})`);
}

function updateOrderForOutcome(
  tx: Transaction,
  orderRef: DocumentReference<OrderData>,
  order: OrderData,
  outcome: GatewayResult['outcome'],
  result: GatewayResult,
  current: boolean,
  provider: Provider,
) {
  const stamp = { paymentUpdatedAt: FieldValue.serverTimestamp() };

  if (outcome === 'PAID') {
    // Money arrived for an order that was cancelled meanwhile, or for an older
    // attempt: never silently keep it. Flag for staff to refund or reinstate.
    if (order.status === 'CANCELLED' || !current || order.paymentStatus === 'PAID') {
      tx.update(orderRef, {
        ...stamp,
        paymentStatus: 'REVIEW',
        paymentMessage: `A ${PROVIDER_NAME[provider]} payment arrived that needs checking by our team (reference ${result.providerRef ?? '-'}).`,
      });
      return;
    }
    tx.update(orderRef, {
      ...stamp,
      paymentStatus: 'PAID',
      paymentMessage: result.message,
      paymentRef: result.providerRef ?? null,
      paidAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (!current) return; // A newer attempt owns the order's payment fields.

  if (outcome === 'FAILED') {
    tx.update(orderRef, { ...stamp, paymentStatus: 'FAILED', paymentMessage: result.message });
  } else if (outcome === 'REVIEW') {
    tx.update(orderRef, {
      ...stamp,
      paymentStatus: 'REVIEW',
      paymentMessage: 'We could not confirm this payment automatically. Our team will check it — please do not pay again.',
    });
  } else {
    tx.update(orderRef, { ...stamp, paymentMessage: result.message });
  }
}

// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------

/** Ask the gateway again about attempts that ended without a definite answer. */
export async function reconcilePending(): Promise<void> {
  const snapshot = await db.collection('payments').where('status', 'in', ['PROCESSING', 'PENDING']).limit(50).get();
  const grace = config.gatewayTimeoutMs + 30_000;

  for (const doc of snapshot.docs) {
    const payment = doc.data() as PaymentData;
    if (inFlight.has(doc.id)) continue;
    // A PROCESSING attempt younger than the gateway timeout may still be
    // running in a previous process; leave it alone until it can't be.
    if (payment.status === 'PROCESSING' && Date.now() - payment.createdAt.toMillis() < grace) continue;

    const gateway = gateways[payment.provider];
    if (!gateway) continue;
    inFlight.add(doc.id);
    try {
      await applyResult(doc.id, await gateway.inquire(doc.id, payment.amount));
    } catch (error) {
      console.error(`[payment] ${doc.id} inquiry failed:`, error);
    } finally {
      inFlight.delete(doc.id);
    }
  }
}

/** Cancel online orders that were never paid within the window, returning their stock. */
export async function expireUnpaidOrders(): Promise<void> {
  const snapshot = await db.collection('orders').where('paymentStatus', 'in', ['UNPAID', 'FAILED']).limit(100).get();
  const cutoff = Date.now() - config.paymentWindowMinutes * 60_000;

  for (const doc of snapshot.docs) {
    const order = doc.data() as OrderData;
    if (order.status !== 'PENDING' || (order.createdAt?.toMillis() ?? Date.now()) > cutoff) continue;

    try {
      const expired = await db.runTransaction(async (tx) => {
        const orderRef = doc.ref as DocumentReference<OrderData>;
        const fresh = (await tx.get(orderRef)).data();
        if (!fresh || fresh.status !== 'PENDING' || !['UNPAID', 'FAILED'].includes(fresh.paymentStatus ?? '')) return false;

        const quantities = new Map<string, number>();
        for (const line of fresh.items) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
        const productRefs = fresh.stockDeducted ? [...quantities.keys()].map((id) => db.doc(`products/${id}`)) : [];
        const products = await Promise.all(productRefs.map((ref) => tx.get(ref)));

        products.forEach((product) => {
          if (!product.exists) return;
          tx.update(product.ref, { stock: FieldValue.increment(quantities.get(product.id) ?? 0) });
        });

        const note = `Auto-cancelled: not paid within ${config.paymentWindowMinutes} minutes.`;
        tx.update(orderRef, {
          status: 'CANCELLED',
          stockDeducted: false,
          paymentStatus: 'EXPIRED',
          paymentMessage: 'The time to pay passed, so this order was cancelled. You can place it again.',
          adminNote: fresh.adminNote ? `${fresh.adminNote}\n${note}` : note,
          updatedAt: FieldValue.serverTimestamp(),
          paymentUpdatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (expired) console.info(`[payment] order ${doc.id} expired unpaid; stock returned`);
    } catch (error) {
      console.error(`[payment] expiring order ${doc.id} failed:`, error);
    }
  }
}
