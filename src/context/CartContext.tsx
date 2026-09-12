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
import { useSettings } from '@/context/SettingsContext';
import { clampToZero, lineTotal } from '@/lib/money';
import { readJSON, removeKey, STORAGE_KEYS, writeJSON } from '@/lib/storage';
import {
  clearCart as clearServerCart,
  mergeGuestCart,
  removeCartLine,
  setCartLine,
  subscribeToCart,
} from '@/services/cart';
import { MAX_ORDER_LINES } from '@/services/orders';
import type { CartLine, OrderTotals, ResolvedCartLine } from '@/types';

export type AddResult = 'added' | 'capped' | 'unavailable' | 'line-limit' | 'suspended' | 'error';

interface CartContextValue {
  lines: ResolvedCartLine[];
  totalItems: number;
  subtotal: number;
  /** True while the signed-in cart is still loading from Firestore. */
  syncing: boolean;
  getTotals: (discount?: number) => OrderTotals;
  addItem: (productId: string, quantity?: number) => Promise<AddResult>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, suspended, loading: authLoading } = useAuth();
  const { products } = useCatalog();
  const { logistics } = useSettings();

  const [guestLines, setGuestLines] = useState<CartLine[]>(() =>
    readJSON<CartLine[]>(STORAGE_KEYS.cart, []),
  );
  const [serverLines, setServerLines] = useState<CartLine[]>([]);
  // The uid whose first snapshot has arrived. `syncing` is derived from it
  // rather than toggled, so no state is set synchronously inside an effect.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  const signedIn = Boolean(user);
  const syncing = signedIn && syncedFor !== user?.uid;
  const rawLines = signedIn ? serverLines : guestLines;

  // Guest cart persistence.
  useEffect(() => {
    if (!signedIn) writeJSON(STORAGE_KEYS.cart, guestLines);
  }, [guestLines, signedIn]);

  // Live server cart while signed in.
  useEffect(() => {
    if (!user) return undefined;

    const uid = user.uid;
    const unsubscribe = subscribeToCart(uid, (lines) => {
      setServerLines(lines);
      setSyncedFor(uid);
    });

    // Runs on sign-out or account switch. Clearing here — before the next
    // account's subscription starts — means a shared device never shows the
    // previous user's cart, even for a frame.
    return () => {
      unsubscribe();
      setServerLines([]);
      setSyncedFor(null);
    };
  }, [user]);

  /**
   * Merge the guest cart into the account exactly once per sign-in.
   * The ref guards against React StrictMode running effects twice in
   * development, which would otherwise double every quantity.
   */
  const mergedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || authLoading) return;
    if (mergedFor.current === user.uid) return;
    mergedFor.current = user.uid;

    const pending = readJSON<CartLine[]>(STORAGE_KEYS.cart, []);
    if (pending.length === 0) return;

    const stockOf = (productId: string) =>
      products.find((product) => product.id === productId)?.stock ?? 0;

    mergeGuestCart(user.uid, pending, stockOf)
      .then(() => {
        removeKey(STORAGE_KEYS.cart);
        setGuestLines([]);
      })
      .catch((error) => console.error('Cart merge failed:', error));
  }, [user, authLoading, products]);

  // Reset the guard on sign-out so the next sign-in merges again.
  useEffect(() => {
    if (!user) mergedFor.current = null;
  }, [user]);

  /** Join stored lines to live products, dropping anything gone and clamping to stock. */
  const lines = useMemo<ResolvedCartLine[]>(
    () =>
      rawLines.flatMap((line) => {
        const product = products.find((candidate) => candidate.id === line.productId);
        if (!product || product.stock <= 0) return [];
        const quantity = Math.min(line.quantity, product.stock);
        return [{ product, quantity, lineTotal: lineTotal(product.price, quantity) }];
      }),
    [rawLines, products],
  );

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines]);
  const totalItems = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  const getTotals = useCallback(
    (discount = 0): OrderTotals => {
      const safeDiscount = Math.min(clampToZero(discount), subtotal);
      const discounted = subtotal - safeDiscount;
      // Same values firestore.rules checks the order's shipping against.
      const qualifies = discounted >= logistics.freeShippingThreshold;
      const shipping = lines.length === 0 || qualifies ? 0 : logistics.standardShippingFee;

      return {
        subtotal,
        discount: safeDiscount,
        shipping,
        total: discounted + shipping,
        freeShippingShortfall: clampToZero(logistics.freeShippingThreshold - discounted),
      };
    },
    [subtotal, lines.length, logistics],
  );

  const writeLine = useCallback(
    async (productId: string, quantity: number) => {
      if (user) {
        await setCartLine(user.uid, productId, quantity);
        return;
      }
      setGuestLines((current) =>
        current.some((line) => line.productId === productId)
          ? current.map((line) => (line.productId === productId ? { ...line, quantity } : line))
          : [...current, { productId, quantity }],
      );
    },
    [user],
  );

  const addItem = useCallback<CartContextValue['addItem']>(
    async (productId, quantity = 1) => {
      if (user && suspended) return 'suspended';

      const product = products.find((candidate) => candidate.id === productId);
      if (!product || product.stock <= 0) return 'unavailable';

      const existing = rawLines.find((line) => line.productId === productId);

      // Firestore rules can only verify MAX_ORDER_LINES lines per order, so
      // refuse to build a cart that could never be checked out.
      if (!existing && rawLines.length >= MAX_ORDER_LINES) return 'line-limit';

      const desired = (existing?.quantity ?? 0) + quantity;
      const next = Math.min(desired, product.stock, 99);

      try {
        await writeLine(productId, next);
      } catch (error) {
        // The rules are the final word — e.g. stock changed, or the account
        // was suspended after this page loaded.
        console.error('Cart write refused:', error);
        return (error as { code?: string })?.code === 'permission-denied' && suspended
          ? 'suspended'
          : 'error';
      }
      return next < desired ? 'capped' : 'added';
    },
    [products, rawLines, writeLine, user, suspended],
  );

  const updateQuantity = useCallback<CartContextValue['updateQuantity']>(
    async (productId, quantity) => {
      const product = products.find((candidate) => candidate.id === productId);
      if (!product) return;

      if (quantity <= 0) {
        if (user) await removeCartLine(user.uid, productId);
        else setGuestLines((current) => current.filter((line) => line.productId !== productId));
        return;
      }

      await writeLine(productId, Math.min(quantity, product.stock, 99));
    },
    [products, user, writeLine],
  );

  const removeItem = useCallback<CartContextValue['removeItem']>(
    async (productId) => {
      if (user) await removeCartLine(user.uid, productId);
      else setGuestLines((current) => current.filter((line) => line.productId !== productId));
    },
    [user],
  );

  const clear = useCallback(async () => {
    if (user) await clearServerCart(user.uid);
    else setGuestLines([]);
  }, [user]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      totalItems,
      subtotal,
      syncing,
      getTotals,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [lines, totalItems, subtotal, syncing, getTotals, addItem, updateQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
