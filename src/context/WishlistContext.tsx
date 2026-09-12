import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { readJSON, removeKey, STORAGE_KEYS, writeJSON } from '@/lib/storage';
import {
  addWishlistItem,
  clearWishlist as clearServerWishlist,
  mergeGuestWishlist,
  removeWishlistItem,
  subscribeToWishlist,
} from '@/services/wishlist';
import type { Product } from '@/types';

interface WishlistContextValue {
  items: Product[];
  count: number;
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<'added' | 'removed'>;
  clear: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { products } = useCatalog();

  const [guestIds, setGuestIds] = useState<string[]>(() =>
    readJSON<string[]>(STORAGE_KEYS.wishlist, []),
  );
  const [serverIds, setServerIds] = useState<string[]>([]);

  const signedIn = Boolean(user);
  const ids = signedIn ? serverIds : guestIds;

  useEffect(() => {
    if (!signedIn) writeJSON(STORAGE_KEYS.wishlist, guestIds);
  }, [guestIds, signedIn]);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = subscribeToWishlist(user.uid, setServerIds);
    // Clear on sign-out/switch so the next account never sees these ids.
    return () => {
      unsubscribe();
      setServerIds([]);
    };
  }, [user]);

  // Fold the guest watchlist into the account once per sign-in.
  const mergedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || authLoading) return;
    if (mergedFor.current === user.uid) return;
    mergedFor.current = user.uid;

    const pending = readJSON<string[]>(STORAGE_KEYS.wishlist, []);
    if (pending.length === 0) return;

    mergeGuestWishlist(user.uid, pending)
      .then(() => {
        removeKey(STORAGE_KEYS.wishlist);
        setGuestIds([]);
      })
      .catch((error) => console.error('Wishlist merge failed:', error));
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) mergedFor.current = null;
  }, [user]);

  const items = useMemo(
    () =>
      ids
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [ids, products],
  );

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback<WishlistContextValue['toggle']>(
    async (productId) => {
      const isSaved = ids.includes(productId);

      if (user) {
        if (isSaved) await removeWishlistItem(user.uid, productId);
        else await addWishlistItem(user.uid, productId);
      } else {
        setGuestIds((current) =>
          isSaved ? current.filter((id) => id !== productId) : [...current, productId],
        );
      }

      return isSaved ? 'removed' : 'added';
    },
    [ids, user],
  );

  const clear = useCallback(async () => {
    if (user) await clearServerWishlist(user.uid);
    else setGuestIds([]);
  }, [user]);

  const value = useMemo<WishlistContextValue>(
    () => ({ items, count: items.length, has, toggle, clear }),
    [items, has, toggle, clear],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
}
