import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import { toCategory, toProduct } from '@/services/catalog';
import { toIso, type OrderDoc } from '@/services/orders';
import type { Category, Coupon, Product } from '@/types';

/**
 * Admin data access.
 *
 * Nothing here is privileged in itself — every call runs with the signed-in
 * user's credentials and is authorised by firestore.rules. A customer who
 * reached these functions would simply get permission-denied. The admin UI
 * hides them for usability, not for security.
 */

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses at which the order's units have left inventory. */
const COMMITTED: readonly OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** The transitions the admin UI offers from each status. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function toOrder(id: string, data: Record<string, unknown>): OrderDoc {
  return {
    id,
    ...data,
    createdAt: toIso(data.createdAt),
    ...(data.paidAt ? { paidAt: toIso(data.paidAt) } : {}),
  } as OrderDoc;
}

export async function fetchAllOrders(max = 500): Promise<OrderDoc[]> {
  const snapshot = await getDocs(
    query(collection(getDbOrThrow(), 'orders'), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map((snap) => toOrder(snap.id, snap.data()));
}

export async function fetchOrder(orderId: string): Promise<OrderDoc | null> {
  const snap = await getDoc(doc(getDbOrThrow(), 'orders', orderId));
  return snap.exists() ? toOrder(snap.id, snap.data()) : null;
}

export class InsufficientStockError extends Error {
  readonly productName: string;
  readonly available: number;
  readonly requested: number;

  constructor(productName: string, available: number, requested: number) {
    super(`Only ${available} of "${productName}" in stock; this order needs ${requested}.`);
    this.name = 'InsufficientStockError';
    this.productName = productName;
    this.available = available;
    this.requested = requested;
  }
}

/**
 * Moves an order to a new status and keeps inventory consistent, atomically.
 *
 * - Orders placed from the storefront already had their stock taken at
 *   checkout (`stockDeducted: true`), so confirming them changes no stock.
 * - Older orders placed before checkout reservation: the first move into a
 *   committed status deducts each line, and fails if any product is short.
 * - Cancelling an order whose stock was deducted puts the units back.
 * - `stockDeducted` on the order makes both operations happen exactly once,
 *   even if the button is pressed twice or two staff act at the same time:
 *   the transaction re-reads the order and retries on conflict.
 *
 * Overselling is prevented at checkout: the rules refuse an order whose
 * stock decrement would take any product below zero.
 */
export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  adminNote: string,
): Promise<void> {
  const db = getDbOrThrow();
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error('Order no longer exists.');

    const order = orderSnap.data() as OrderDoc;
    const deducted = Boolean(order.stockDeducted);
    const shouldDeduct = !deducted && COMMITTED.includes(next);
    const shouldRestock = deducted && next === 'CANCELLED';

    // Aggregate by product in case a product appears on two lines.
    const quantities = new Map<string, { qty: number; name: string }>();
    for (const line of order.items) {
      const entry = quantities.get(line.productId) ?? { qty: 0, name: line.name };
      entry.qty += line.quantity;
      quantities.set(line.productId, entry);
    }

    // Firestore transactions require every read before any write.
    const productSnaps =
      shouldDeduct || shouldRestock
        ? await Promise.all(
            [...quantities.keys()].map(async (id) => ({
              id,
              snap: await tx.get(doc(db, 'products', id)),
            })),
          )
        : [];

    if (shouldDeduct) {
      for (const { id, snap } of productSnaps) {
        // A product deleted since the order was placed has no stock to take.
        if (!snap.exists()) continue;
        const need = quantities.get(id);
        const available = Number(snap.data().stock ?? 0);
        if (need && available < need.qty) {
          throw new InsufficientStockError(need.name, available, need.qty);
        }
      }
      for (const { id, snap } of productSnaps) {
        if (!snap.exists()) continue;
        const need = quantities.get(id);
        if (need) tx.update(snap.ref, { stock: Number(snap.data().stock ?? 0) - need.qty });
      }
    }

    if (shouldRestock) {
      for (const { id, snap } of productSnaps) {
        if (!snap.exists()) continue;
        const need = quantities.get(id);
        if (need) tx.update(snap.ref, { stock: Number(snap.data().stock ?? 0) + need.qty });
      }
    }

    tx.update(orderRef, {
      status: next,
      stockDeducted: shouldDeduct ? true : shouldRestock ? false : deducted,
      adminNote: adminNote.slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Saves a note without touching status or inventory. */
export async function saveOrderNote(orderId: string, adminNote: string): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'orders', orderId), {
    adminNote: adminNote.slice(0, 1000),
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Every product, archived ones included — the storefront only loads active. */
export async function fetchAllProducts(): Promise<Product[]> {
  const snapshot = await getDocs(collection(getDbOrThrow(), 'products'));
  return snapshot.docs
    .map((snap) => toProduct(snap.id, snap.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(getDbOrThrow(), 'products', productId));
  return snap.exists() ? toProduct(snap.id, snap.data()) : null;
}

export interface ProductInput {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  category: string;
  tier: Product['tier'];
  price: number;
  compareAtPrice: number | null;
  stock: number;
  shortDescription: string;
  description: string;
  highlights: string[];
  specifications: Product['specifications'];
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Another product already uses the URL "/product/${slug}".`);
    this.name = 'SlugTakenError';
  }
}

async function assertSlugAvailable(slug: string, exceptId: string | null) {
  const clash = await getDocs(
    query(collection(getDbOrThrow(), 'products'), where('slug', '==', slug), limit(2)),
  );
  if (clash.docs.some((snap) => snap.id !== exceptId)) throw new SlugTakenError(slug);
}

/**
 * Creates (productId = null) or updates a product. Returns the id.
 * Ratings and the date added are preserved on edit.
 */
/**
 * `loadedStock` is the stock figure the editor form opened with. Customers'
 * orders take stock while the form is open, so if staff left the field alone
 * the live figure is kept rather than overwritten with the stale one.
 */
export async function saveProduct(
  productId: string | null,
  input: ProductInput,
  loadedStock?: number,
): Promise<string> {
  const db = getDbOrThrow();
  await assertSlugAvailable(input.slug, productId);

  const ref = productId ? doc(db, 'products', productId) : doc(collection(db, 'products'));

  await runTransaction(db, async (tx) => {
    const existing = productId ? await tx.get(ref) : null;
    const previous = existing?.exists() ? existing.data() : null;
    const stockUntouched = previous && loadedStock !== undefined && input.stock === loadedStock;

    tx.set(ref, {
      ...input,
      stock: stockUntouched ? Number(previous.stock ?? input.stock) : input.stock,
      // Firestore rules treat an absent compareAtPrice as "not on sale"; store
      // null explicitly so clearing a sale price actually clears it.
      compareAtPrice: input.compareAtPrice,
      rating: Number(previous?.rating ?? 0),
      reviewCount: Number(previous?.reviewCount ?? 0),
      addedAt: String(previous?.addedAt ?? new Date().toISOString().slice(0, 10)),
      updatedAt: serverTimestamp(),
    });
  });

  return ref.id;
}

export async function setProductActive(productId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'products', productId), { isActive, updatedAt: serverTimestamp() });
}

export async function setProductStock(productId: string, stock: number): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'products', productId), { stock, updatedAt: serverTimestamp() });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'products', productId));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Every category, hidden ones included, in display order. */
export async function fetchAllCategories(): Promise<Category[]> {
  const snapshot = await getDocs(query(collection(getDbOrThrow(), 'categories'), orderBy('sortOrder')));
  return snapshot.docs.map((snap) => toCategory(snap.id, snap.data()));
}

async function productRefsInCategory(name: string) {
  const snapshot = await getDocs(
    query(collection(getDbOrThrow(), 'products'), where('category', '==', name)),
  );
  return snapshot.docs.map((snap) => snap.ref);
}

export async function countProductsInCategory(name: string): Promise<number> {
  return (await productRefsInCategory(name)).length;
}

export class CategoryInUseError extends Error {
  constructor(name: string, count: number) {
    super(`"${name}" still has ${count} product${count === 1 ? '' : 's'}. Move or delete them first — or hide the category instead.`);
    this.name = 'CategoryInUseError';
  }
}

/**
 * Creates or updates a category (keyed by its slug, which never changes).
 * Products reference their category by NAME, so a rename also moves every
 * product in the old name across. Returns how many products were moved.
 */
export async function saveCategory(category: Category, previousName: string | null): Promise<number> {
  const db = getDbOrThrow();
  await setDoc(doc(db, 'categories', category.slug), {
    name: category.name.trim(),
    slug: category.slug,
    iconKey: category.iconKey,
    colorHex: category.colorHex,
    tagline: category.tagline.trim(),
    description: category.description.trim(),
    sortOrder: category.sortOrder ?? 0,
    isActive: category.isActive !== false,
  });

  const renamed = previousName !== null && previousName !== category.name.trim();
  if (!renamed) return 0;

  const refs = await productRefsInCategory(previousName);
  // Batches cap at 500 writes; chunk to stay clear.
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) =>
      batch.update(ref, { category: category.name.trim(), updatedAt: serverTimestamp() }),
    );
    await batch.commit();
  }
  return refs.length;
}

/** Swaps two categories' positions. */
export async function swapCategoryOrder(a: Category, b: Category): Promise<void> {
  const db = getDbOrThrow();
  const batch = writeBatch(db);
  batch.update(doc(db, 'categories', a.slug), { sortOrder: b.sortOrder ?? 0 });
  batch.update(doc(db, 'categories', b.slug), { sortOrder: a.sortOrder ?? 0 });
  await batch.commit();
}

export async function deleteCategory(category: Category): Promise<void> {
  const count = await countProductsInCategory(category.name);
  if (count > 0) throw new CategoryInUseError(category.name, count);
  await deleteDoc(doc(getDbOrThrow(), 'categories', category.slug));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerRow {
  uid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  suspended: boolean;
  suspensionReason: string;
}

export async function fetchCustomers(): Promise<CustomerRow[]> {
  const db = getDbOrThrow();
  const [users, roles, suspensions] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'roles')),
    getDocs(collection(db, 'suspensions')),
  ]);

  const roleOf = new Map(roles.docs.map((snap) => [snap.id, String(snap.data().role ?? '')]));
  const suspensionOf = new Map(
    suspensions.docs.map((snap) => [snap.id, String(snap.data().reason ?? '')]),
  );

  return users.docs
    .map((snap) => {
      const data = snap.data();
      const role = roleOf.get(snap.id);
      return {
        uid: snap.id,
        name: String(data.name ?? ''),
        email: String(data.email ?? ''),
        phone: String(data.phone ?? ''),
        city: String(data.city ?? ''),
        role: role === 'ADMIN' || role === 'STAFF' ? role : 'CUSTOMER',
        suspended: suspensionOf.has(snap.id),
        suspensionReason: suspensionOf.get(snap.id) ?? '',
      } satisfies CustomerRow;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Grants STAFF. Rules allow this only for an ADMIN acting on someone else, and
 * only ever the STAFF role — ADMIN stays script-only.
 */
export async function grantStaff(uid: string, grantedBy: string): Promise<void> {
  await setDoc(doc(getDbOrThrow(), 'roles', uid), {
    role: 'STAFF',
    grantedBy,
    grantedAt: serverTimestamp(),
  });
}

export async function revokeStaff(uid: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'roles', uid));
}

/**
 * Soft suspension: the account can still sign in, but the security rules
 * refuse its cart and order writes while this document exists.
 */
export async function suspendCustomer(uid: string, reason: string, suspendedBy: string): Promise<void> {
  await setDoc(doc(getDbOrThrow(), 'suspensions', uid), {
    reason: reason.trim().slice(0, 500),
    suspendedBy,
    suspendedAt: serverTimestamp(),
  });
}

export async function reinstateCustomer(uid: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'suspensions', uid));
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function fetchAllCoupons(): Promise<Coupon[]> {
  const snapshot = await getDocs(collection(getDbOrThrow(), 'coupons'));
  return snapshot.docs
    .map((snap) => {
      const data = snap.data();
      return {
        code: snap.id,
        type: data.type === 'fixed' ? 'fixed' : 'percentage',
        value: Number(data.value ?? 0),
        minOrderAmount: Number(data.minOrderAmount ?? 0),
        ...(data.maxDiscountAmount ? { maxDiscountAmount: Number(data.maxDiscountAmount) } : {}),
        description: String(data.description ?? ''),
        isActive: data.isActive !== false,
      } satisfies Coupon;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function saveCoupon(coupon: Coupon): Promise<void> {
  await setDoc(doc(getDbOrThrow(), 'coupons', coupon.code), {
    type: coupon.type,
    value: coupon.value,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscountAmount: coupon.maxDiscountAmount ?? null,
    description: coupon.description,
    isActive: coupon.isActive !== false,
  });
}

export async function deleteCoupon(code: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'coupons', code));
}
