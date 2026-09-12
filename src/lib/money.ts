/**
 * Money helpers.
 *
 * Every amount crossing a module boundary is an integer count of PAISA
 * (1/100 PKR). Floats are never used for money — `0.1 + 0.2 !== 0.3` is not a
 * property you want in an order total.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Rupees typed into the admin panel -> integer paisa for storage.
 * Rounds, so "1600.005" cannot produce a fractional value the security rules
 * would reject.
 */
export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * MINOR_UNITS_PER_MAJOR);
}

/** 160000 paisa -> 1600 rupees. For display and provider APIs only. */
export function toMajorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/**
 * Renders the reference storefront's price format: `Rs. 1,600`.
 * Whole rupees when the paisa component is zero, which is the normal case.
 */
export function formatPrice(minor: number): string {
  const major = toMajorUnits(minor);
  const hasFraction = minor % MINOR_UNITS_PER_MAJOR !== 0;

  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(major);

  return `Rs. ${formatted}`;
}

/** Percentage off, rounded to a whole number for the discount badge. */
export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/** Multiplies a unit price by quantity. Both integers, so the result is exact. */
export function lineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/**
 * Applies a percentage discount, rounding down so we never over-discount by a
 * paisa. `percent` is whole points (10 = 10%).
 */
export function percentageOf(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}

export function clampToZero(amount: number): number {
  return amount < 0 ? 0 : amount;
}
