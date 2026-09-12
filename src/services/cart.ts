import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import type { CartLine } from '@/types';

/**
 * Server-side cart.
 *
 * One document per line under carts/{uid}/items/{productId}, so adding the
 * same product twice updates a single document instead of accumulating
 * duplicates, and the security rules can validate each line independently.
 */

function itemsRef(uid: string) {
  return collection(getDbOrThrow(), 'carts', uid, 'items');
}

/** Live cart subscription. Returns the unsubscribe function. */
export function subscribeToCart(uid: string, onChange: (lines: CartLine[]) => void): () => void {
  return onSnapshot(
    itemsRef(uid),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          productId: snap.id,
          quantity: Number(snap.data().quantity ?? 0),
        })),
      );
    },
    (error) => {
      console.error('Cart subscription failed:', error);
      onChange([]);
    },
  );
}

export async function setCartLine(uid: string, productId: string, quantity: number): Promise<void> {
  await setDoc(doc(itemsRef(uid), productId), { quantity, updatedAt: serverTimestamp() });
}

export async function removeCartLine(uid: string, productId: string): Promise<void> {
  await deleteDoc(doc(itemsRef(uid), productId));
}

export async function clearCart(uid: string): Promise<void> {
  const snapshot = await getDocs(itemsRef(uid));
  if (snapshot.empty) return;

  const batch = writeBatch(getDbOrThrow());
  snapshot.docs.forEach((snap) => batch.delete(snap.ref));
  await batch.commit();
}

/**
 * Folds a guest's local cart into their server cart at sign-in.
 *
 * Quantities are summed rather than overwritten — someone who added two of
 * something while signed out, having already had one saved, should end up with
 * three. `stockOf` clamps the result so the merge cannot produce a line the
 * security rules would later reject.
 */
export async function mergeGuestCart(
  uid: string,
  guestLines: CartLine[],
  stockOf: (productId: string) => number,
): Promise<void> {
  if (guestLines.length === 0) return;

  const existing = await getDocs(itemsRef(uid));
  const current = new Map<string, number>(
    existing.docs.map((snap) => [snap.id, Number(snap.data().quantity ?? 0)]),
  );

  const batch = writeBatch(getDbOrThrow());
  let writes = 0;

  for (const line of guestLines) {
    const stock = stockOf(line.productId);
    if (stock <= 0) continue; // product gone or out of stock — drop it silently

    const merged = Math.min((current.get(line.productId) ?? 0) + line.quantity, stock, 99);
    if (merged <= 0) continue;

    batch.set(doc(itemsRef(uid), line.productId), {
      quantity: merged,
      updatedAt: serverTimestamp(),
    });
    writes += 1;
  }

  if (writes > 0) await batch.commit();
}
