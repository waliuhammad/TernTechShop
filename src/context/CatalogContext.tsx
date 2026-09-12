import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '@/services/catalog';
import { categories as localCategories } from '@/data/categories';
import { products as localProducts } from '@/data/products';
import type { Category, Product } from '@/types';

interface CatalogContextValue {
  products: Product[];
  categories: Category[];
  loading: boolean;
  /** True when showing bundled data because Firestore was unavailable/empty. */
  usedFallback: boolean;
  findBySlug: (slug: string) => Product | undefined;
  findById: (id: string) => Product | undefined;
  featured: (limit?: number) => Product[];
  related: (product: Product, limit?: number) => Product[];
  countByCategory: (category: string) => number;
  countByTier: (tier: string) => number;
  maxPrice: number;
  /** Re-reads Firestore; call after an admin edit. */
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  // Seeded with the bundled catalog so the first paint is never empty; the
  // Firestore result replaces it as soon as it arrives.
  const [products, setProducts] = useState<Product[]>(localProducts);
  const [categories, setCategories] = useState<Category[]>(localCategories);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(true);

  const refresh = useCallback(async () => {
    const payload = await loadCatalog();
    setProducts(payload.products);
    setCategories(payload.categories);
    setUsedFallback(payload.usedFallback);
  }, []);

  useEffect(() => {
    let active = true;

    loadCatalog()
      .then((payload) => {
        if (!active) return;
        setProducts(payload.products);
        setCategories(payload.categories);
        setUsedFallback(payload.usedFallback);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<CatalogContextValue>(() => {
    const maxPrice = products.reduce((max, p) => (p.price > max ? p.price : max), 0);

    return {
      products,
      categories,
      loading,
      usedFallback,
      maxPrice,
      refresh,
      findBySlug: (slug) => products.find((p) => p.slug === slug),
      findById: (id) => products.find((p) => p.id === id),
      featured: (limit = 4) => products.filter((p) => p.isFeatured).slice(0, limit),
      related: (product, limit = 4) =>
        products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit),
      countByCategory: (category) => products.filter((p) => p.category === category).length,
      countByTier: (tier) => products.filter((p) => p.tier === tier).length,
    };
  }, [products, categories, loading, usedFallback, refresh]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within a CatalogProvider');
  return context;
}
