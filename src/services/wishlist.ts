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

function itemsRef(uid: string) {
  return collection(getDbOrThrow(), 'wishlists', uid, 'items');
}

export function subscribeToWishlist(uid: string, onChange: (ids: string[]) => void): () => void {
  return onSnapshot(
    itemsRef(uid),
    (snapshot) => onChange(snapshot.docs.map((snap) => snap.id)),
    (error) => {
      console.error('Wishlist subscription failed:', error);
      onChange([]);
    },
  );
}

export async function addWishlistItem(uid: string, productId: string): Promise<void> {
  await setDoc(doc(itemsRef(uid), productId), { addedAt: serverTimestamp() });
}

export async function removeWishlistItem(uid: string, productId: string): Promise<void> {
  await deleteDoc(doc(itemsRef(uid), productId));
}

export async function clearWishlist(uid: string): Promise<void> {
  const snapshot = await getDocs(itemsRef(uid));
  if (snapshot.empty) return;

  const batch = writeBatch(getDbOrThrow());
  snapshot.docs.forEach((snap) => batch.delete(snap.ref));
  await batch.commit();
}

/** Folds a guest's local watchlist into their account at sign-in. */
export async function mergeGuestWishlist(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const batch = writeBatch(getDbOrThrow());
  ids.forEach((id) => batch.set(doc(itemsRef(uid), id), { addedAt: serverTimestamp() }));
  await batch.commit();
}
