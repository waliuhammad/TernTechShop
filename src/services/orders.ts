import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import type { OrderTotals, ResolvedCartLine, ShippingDetails } from '@/types';

/**
 * Orders.
 *
 * The document written here is re-validated by firestore.rules before it is
 * accepted: every unit price is checked against the live product, the totals
 * are recomputed, and any coupon is looked up server-side. A write that does
 * not add up is rejected, so the figures below are a proposal, not a promise.
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
 * Rules can only verify this many lines within Firestore's 10-lookup budget:
 * 7 products + coupon + suspension check + shipping settings.
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
}

export async function placeOrder(input: PlaceOrderInput): Promise<string> {
  const { userId, lines, totals, shipping, couponCode } = input;

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

  const payload = {
    manifestId,
    userId,
    status: 'PENDING',
    paymentMethod: 'COD',
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
  };

  try {
    await setDoc(doc(collection(db, 'orders')), payload);
  } catch (error) {
    // `permission-denied` here means the rules rejected the arithmetic — in
    // practice, a price changed between browsing and checkout.
    if ((error as { code?: string })?.code === 'permission-denied') {
      throw new OrderRejectedError(
        'This manifest could not be authorized. A component price or stock level changed — reload your cart and try again.',
      );
    }
    throw error;
  }

  return manifestId;
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

  return snapshot.docs.map((snap) => {
    const data = snap.data();
    return { id: snap.id, ...data, createdAt: toIso(data.createdAt) } as OrderDoc;
  });
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
  if (!snap) return null;

  const data = snap.data();
  return { id: snap.id, ...data, createdAt: toIso(data.createdAt) } as OrderDoc;
}
