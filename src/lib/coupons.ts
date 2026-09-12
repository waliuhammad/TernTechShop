import { doc, getDoc } from 'firebase/firestore';
import { coupons as localCoupons } from '@/data/site-data';
import { getDbOrThrow, isFirebaseConfigured } from '@/lib/firebase';
import { clampToZero, percentageOf } from '@/lib/money';
import type { Coupon } from '@/types';

/**
 * Coupons.
 *
 * Lookup is by exact code: the security rules allow `get` on a single coupon
 * but forbid listing the collection, so codes cannot be enumerated. Whatever
 * the client computes here is a preview — the order write is re-validated
 * against the same coupon server-side.
 */

export type CouponEvaluation =
  | { status: 'valid'; discount: number }
  | { status: 'below-minimum'; minOrderAmount: number }
  | { status: 'inactive' };

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Resolves a code to its coupon, or null if it does not exist. */
export async function fetchCoupon(code: string): Promise<Coupon | null> {
  const normalised = normaliseCode(code);
  if (!normalised || !/^[A-Z0-9_-]{2,40}$/.test(normalised)) return null;

  if (!isFirebaseConfigured) {
    return localCoupons.find((coupon) => coupon.code === normalised) ?? null;
  }

  try {
    const snap = await getDoc(doc(getDbOrThrow(), 'coupons', normalised));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      code: normalised,
      type: data.type === 'fixed' ? 'fixed' : 'percentage',
      value: Number(data.value ?? 0),
      minOrderAmount: Number(data.minOrderAmount ?? 0),
      ...(data.maxDiscountAmount ? { maxDiscountAmount: Number(data.maxDiscountAmount) } : {}),
      description: String(data.description ?? ''),
      isActive: data.isActive !== false,
    };
  } catch (error) {
    console.error('Coupon lookup failed:', error);
    return null;
  }
}

/**
 * Pure: what this coupon is worth against a subtotal. Mirrors
 * `couponDiscount()` in firestore.rules exactly — if the two ever disagree,
 * every order using the coupon is rejected.
 */
export function evaluateCoupon(coupon: Coupon, subtotal: number): CouponEvaluation {
  if (coupon.isActive === false) return { status: 'inactive' };
  if (subtotal < coupon.minOrderAmount) {
    return { status: 'below-minimum', minOrderAmount: coupon.minOrderAmount };
  }

  const raw = coupon.type === 'percentage' ? percentageOf(subtotal, coupon.value) : coupon.value;
  const capped =
    coupon.maxDiscountAmount !== undefined ? Math.min(raw, coupon.maxDiscountAmount) : raw;

  return { status: 'valid', discount: clampToZero(Math.min(capped, subtotal)) };
}
