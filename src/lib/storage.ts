/**
 * Safe localStorage access.
 *
 * Every call is guarded: storage throws in private browsing modes, when the
 * quota is exceeded, and when site data is blocked. A storefront must not
 * white-screen because a cart could not be persisted, so failures degrade to
 * in-memory state for the session.
 */

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked — the in-memory state stays correct
    // for this session, which is the best available outcome.
  }
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

export const STORAGE_KEYS = {
  cart: 'terntech.cart.v1',
  wishlist: 'terntech.wishlist.v1',
} as const;
