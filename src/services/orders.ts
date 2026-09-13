import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import type { PaymentMethod, PaymentStatus } from '@/services/payments';
import type { OrderTotals, ResolvedCartLine, ShippingDetails } from '@/types';

/**
 * Orders.
 *
 * The document written here is re-validated by firestore.rules before it is
 * accepted: every unit price is checked against the live product, the totals
 * are recomputed, and any coupon is looked up server-side. A write that does
 * not add up is rejected, so the figures below are a proposal, not a promise.
 *
 * Stock is reserved at the same moment: the order and a decrement of each
 * product's stock are one batched write, so either both land or neither does,
 * and the rules refuse any decrement that would take stock below zero.
 */

const MANIFEST_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Human-facing manifest id, e.g. TT-2K9F4A. Ambiguous characters (I, O, 0, 1)
 * are excluded so the code survives being read aloud over the phone.
 */
function generateManifestId(): string {
  const random = crypto.getRandomValues(new Uint8Array(6));
  const body = Array.from(random, (byte) => MANIFEST_ALPHABET[byte % MANIFEST_ALPHABET.length]).join('');
  return `TT-${body}`;
}

/**
 * Rules can only verify this many lines within Firestore's per-request limits
 * (10 lookups per document: 7 products + coupon + suspension check + shipping
 * settings; and 1,000 evaluated expressions for the whole checkout write).
 */
export const MAX_ORDER_LINES = 7;

export interface OrderLine {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDoc {
  id: string;
  manifestId: string;
  userId: string;
  status: string;
  paymentMethod: string;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  createdAt: string;
  stockDeducted?: boolean;
  adminNote?: string;
  /** Online orders only; written by the payment server. */
  paymentStatus?: PaymentStatus;
  paymentMessage?: string;
  paymentWallet?: string;
  paymentRef?: string | null;
  paymentAttempts?: number;
  paidAt?: string;
}

/** A product that no longer has enough stock for the cart. */
export class OutOfStockError extends Error {
  productName: string;
  available: number;

  constructor(productName: string, available: number) {
    super(
      available > 0
        ? `Only ${available} x ${productName} left in stock. Reduce the quantity in your cart and try again.`
        : `${productName} has just sold out. Remove it from your cart to continue.`,
    );
    this.name = 'OutOfStockError';
    this.productName = productName;
    this.available = available;
  }
}

export class OrderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderRejectedError';
  }
}

export function toIso(value: unknown): string {
  if (value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export interface PlaceOrderInput {
  userId: string;
  lines: ResolvedCartLine[];
  totals: OrderTotals;
  shipping: ShippingDetails;
  couponCode?: string;
  paymentMethod: PaymentMethod;
}

export interface PlacedOrder {
  orderId: string;
  manifestId: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { userId, lines, totals, shipping, couponCode, paymentMethod } = input;

  if (lines.length === 0) {
    throw new OrderRejectedError('Your manifest is empty.');
  }
  if (lines.length > MAX_ORDER_LINES) {
    throw new OrderRejectedError(
      `A single manifest can carry at most ${MAX_ORDER_LINES} distinct components. Split the order or contact an engineer for a bulk manifest.`,
    );
  }

  const manifestId = generateManifestId();
  const db = getDbOrThrow();

  // Fresh stock, so a shortfall gets a specific message instead of a generic
  // refusal. The batch below is still what actually guarantees it.
  const productSnaps = await Promise.all(lines.map((line) => getDoc(doc(db, 'products', line.product.id))));
  lines.forEach((line, index) => {
    const snap = productSnaps[index];
    const available = snap?.exists() ? Number(snap.data().stock ?? 0) : 0;
    if (available < line.quantity) throw new OutOfStockError(line.product.name, available);
  });

  const orderRef = doc(collection(db, 'orders'));

  const payload = {
    manifestId,
    userId,
    status: 'PENDING',
    paymentMethod,
    // Wallet orders start unpaid; only the payment server can mark them paid.
    ...(paymentMethod === 'COD' ? {} : { paymentStatus: 'UNPAID' }),
    items: lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      sku: line.product.sku,
      imageUrl: line.product.images[0] ?? '',
      unitPrice: line.product.price,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    couponCode: couponCode ?? '',
    fullName: shipping.fullName,
    phone: shipping.phone,
    email: shipping.email,
    address: shipping.address,
    city: shipping.city,
    notes: shipping.notes,
    createdAt: serverTimestamp(),
    stockDeducted: true,
    reservations: Object.fromEntries(lines.map((line) => [line.product.id, line.quantity])),
  };

  const batch = writeBatch(db);
  batch.set(orderRef, payload);
  for (const line of lines) {
    batch.update(doc(db, 'products', line.product.id), {
      stock: increment(-line.quantity),
      lastOrderId: orderRef.id,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    // `permission-denied` here means the rules rejected the order — in
    // practice, a price changed or the last units sold between the stock
    // check above and this write.
    if ((error as { code?: string })?.code === 'permission-denied') {
      throw new OrderRejectedError(
        'This manifest could not be authorized. A component price or stock level changed — reload your cart and try again.',
      );
    }
    throw error;
  }

  return { orderId: orderRef.id, manifestId };
}

function toOrderDoc(id: string, data: Record<string, unknown>): OrderDoc {
  return {
    id,
    ...data,
    createdAt: toIso(data.createdAt),
    ...(data.paidAt ? { paidAt: toIso(data.paidAt) } : {}),
  } as OrderDoc;
}

export async function fetchUserOrders(userId: string): Promise<OrderDoc[]> {
  const snapshot = await getDocs(
    query(
      collection(getDbOrThrow(), 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
  );

  return snapshot.docs.map((snap) => toOrderDoc(snap.id, snap.data()));
}

/** Looks an order up by its human-facing manifest id. */
export async function fetchOrderByManifest(
  userId: string,
  manifestId: string,
): Promise<OrderDoc | null> {
  const snapshot = await getDocs(
    query(
      collection(getDbOrThrow(), 'orders'),
      where('userId', '==', userId),
      where('manifestId', '==', manifestId),
      limit(1),
    ),
  );

  const snap = snapshot.docs[0];
  return snap ? toOrderDoc(snap.id, snap.data()) : null;
}

/**
 * Live version of fetchOrderByManifest, so the order page shows a wallet
 * payment change from "approve on your phone" to "paid" without a reload.
 * `onChange(null)` means not found. Returns the unsubscribe function.
 */
export function watchOrderByManifest(
  userId: string,
  manifestId: string,
  onChange: (order: OrderDoc | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDbOrThrow(), 'orders'),
      where('userId', '==', userId),
      where('manifestId', '==', manifestId),
      limit(1),
    ),
    (snapshot) => {
      const snap = snapshot.docs[0];
      onChange(snap ? toOrderDoc(snap.id, snap.data()) : null);
    },
    onError,
  );
}
