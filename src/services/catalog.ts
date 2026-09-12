import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { categories as localCategories } from '@/data/categories';
import { products as localProducts } from '@/data/products';
import { getDbOrThrow, isFirebaseConfigured } from '@/lib/firebase';
import type { Category, Product } from '@/types';

/**
 * Catalog reads.
 *
 * The whole catalog is fetched once and filtered in memory. At this size that
 * is both faster and cheaper than round-tripping every filter change to
 * Firestore, and it keeps sorting and faceting instant. Past a few hundred
 * products this should become a paginated query — see the composite indexes
 * already declared in firestore.indexes.json.
 */

/** Fills in anything an older/partial document omits. */
export function toProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    slug: String(data.slug ?? id),
    name: String(data.name ?? 'Unnamed component'),
    sku: String(data.sku ?? ''),
    brand: String(data.brand ?? ''),
    category: (data.category ?? 'Processors') as Product['category'],
    tier: (data.tier ?? 'Essential') as Product['tier'],
    price: Number(data.price ?? 0),
    ...(data.compareAtPrice ? { compareAtPrice: Number(data.compareAtPrice) } : {}),
    shortDescription: String(data.shortDescription ?? ''),
    description: String(data.description ?? ''),
    highlights: Array.isArray(data.highlights) ? (data.highlights as string[]) : [],
    specifications: Array.isArray(data.specifications)
      ? (data.specifications as Product['specifications'])
      : [],
    images: Array.isArray(data.images) && data.images.length ? (data.images as string[]) : [''],
    stock: Number(data.stock ?? 0),
    isFeatured: Boolean(data.isFeatured),
    isNew: Boolean(data.isNew),
    isActive: data.isActive !== false,
    rating: Number(data.rating ?? 0),
    reviewCount: Number(data.reviewCount ?? 0),
    addedAt: String(data.addedAt ?? new Date().toISOString().slice(0, 10)),
  };
}

export function toCategory(id: string, data: Record<string, unknown>): Category {
  return {
    name: String(data.name ?? id),
    slug: String(data.slug ?? id),
    iconKey: String(data.iconKey ?? 'cpu'),
    colorHex: String(data.colorHex ?? '#3b82f6'),
    tagline: String(data.tagline ?? ''),
    description: String(data.description ?? ''),
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: data.isActive !== false,
  };
}

export interface CatalogPayload {
  products: Product[];
  categories: Category[];
  /** True when the data came from the bundled fallback rather than Firestore. */
  usedFallback: boolean;
}

/**
 * Loads the catalog, falling back to the bundled data if Firebase is not
 * configured, the collection is empty, or the read fails. A storefront that
 * shows nothing is worse than one showing slightly stale data.
 */
export async function loadCatalog(): Promise<CatalogPayload> {
  if (!isFirebaseConfigured) {
    return { products: localProducts, categories: localCategories, usedFallback: true };
  }

  try {
    const db = getDbOrThrow();

    const [productSnap, categorySnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
      getDocs(query(collection(db, 'categories'), orderBy('sortOrder'))),
    ]);

    if (productSnap.empty) {
      return { products: localProducts, categories: localCategories, usedFallback: true };
    }

    const products = productSnap.docs.map((snap) => toProduct(snap.id, snap.data()));

    const categories = categorySnap.empty
      ? localCategories
      : categorySnap.docs
          .map((snap) => toCategory(snap.id, snap.data()))
          // Hidden categories stay in the database (and on their products)
          // but disappear from the storefront.
          .filter((category) => category.isActive !== false);

    return { products, categories, usedFallback: false };
  } catch (error) {
    console.error('Catalog load failed, using bundled data:', error);
    return { products: localProducts, categories: localCategories, usedFallback: true };
  }
}
