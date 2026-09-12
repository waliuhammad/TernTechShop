import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDbOrThrow } from '@/lib/firebase';
import { toIso } from '@/services/orders';

/**
 * Product reviews.
 *
 * One review per customer per product: the document id is
 * `<productId>_<uid>`, which the security rules enforce. New reviews start
 * PENDING and only become public once staff approve them.
 */

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewDoc {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  createdAt: string;
}

function toReview(id: string, data: Record<string, unknown>): ReviewDoc {
  return {
    id,
    productId: String(data.productId ?? ''),
    userId: String(data.userId ?? ''),
    authorName: String(data.authorName ?? 'Customer'),
    rating: Number(data.rating ?? 0),
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    status: (data.status as ReviewStatus) ?? 'PENDING',
    createdAt: toIso(data.createdAt),
  };
}

export const reviewId = (productId: string, uid: string) => `${productId}_${uid}`;

/** Public: approved reviews for one product, newest first. */
export async function fetchApprovedReviews(productId: string): Promise<ReviewDoc[]> {
  const snapshot = await getDocs(
    query(
      collection(getDbOrThrow(), 'reviews'),
      where('productId', '==', productId),
      where('status', '==', 'APPROVED'),
    ),
  );
  return snapshot.docs
    .map((snap) => toReview(snap.id, snap.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The signed-in customer's own review of this product, in any status. */
export async function fetchMyReview(productId: string, uid: string): Promise<ReviewDoc | null> {
  const snap = await getDoc(doc(getDbOrThrow(), 'reviews', reviewId(productId, uid)));
  return snap.exists() ? toReview(snap.id, snap.data()) : null;
}

export interface ReviewInput {
  productId: string;
  uid: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
}

export async function submitReview(input: ReviewInput): Promise<void> {
  await setDoc(doc(getDbOrThrow(), 'reviews', reviewId(input.productId, input.uid)), {
    productId: input.productId,
    userId: input.uid,
    authorName: input.authorName.trim().slice(0, 80),
    rating: input.rating,
    title: input.title.trim().slice(0, 120),
    body: input.body.trim().slice(0, 2000),
    status: 'PENDING',
    createdAt: serverTimestamp(),
  });
}

/** A customer withdrawing their own review. */
export async function deleteOwnReview(productId: string, uid: string): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'reviews', reviewId(productId, uid)));
}

// ---------------------------------------------------------------------------
// Moderation (staff)
// ---------------------------------------------------------------------------

export async function fetchAllReviews(max = 500): Promise<ReviewDoc[]> {
  const snapshot = await getDocs(
    query(collection(getDbOrThrow(), 'reviews'), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map((snap) => toReview(snap.id, snap.data()));
}

/**
 * Recomputes a product's star rating and review count from its approved
 * reviews, so the number on product cards always reflects real feedback.
 */
export async function recomputeProductRating(productId: string): Promise<void> {
  const approved = await fetchApprovedReviews(productId);
  const count = approved.length;
  const average = count ? approved.reduce((sum, review) => sum + review.rating, 0) / count : 0;

  const productRef = doc(getDbOrThrow(), 'products', productId);
  const product = await getDoc(productRef);
  if (!product.exists()) return; // product deleted since

  await updateDoc(productRef, {
    rating: Math.round(average * 10) / 10,
    reviewCount: count,
    updatedAt: serverTimestamp(),
  });
}

export async function moderateReview(
  review: ReviewDoc,
  status: ReviewStatus,
  staffUid: string,
): Promise<void> {
  await updateDoc(doc(getDbOrThrow(), 'reviews', review.id), {
    status,
    moderatedBy: staffUid,
    moderatedAt: serverTimestamp(),
  });
  await recomputeProductRating(review.productId);
}

export async function deleteReview(review: ReviewDoc): Promise<void> {
  await deleteDoc(doc(getDbOrThrow(), 'reviews', review.id));
  await recomputeProductRating(review.productId);
}
