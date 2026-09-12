import type { Product } from '@/types';
import type { SortOption } from '@/config/site';

export interface CatalogFilters {
  search: string;
  categories: string[];
  tiers: string[];
  inStockOnly: boolean;
  maxPrice: number | null;
  sort: SortOption;
}

function matchesSearch(product: Product, term: string): boolean {
  if (!term) return true;
  const haystack = [product.name, product.brand, product.category, product.sku, product.shortDescription]
    .join(' ')
    .toLowerCase();
  // Every whitespace-separated token must appear, so "amd 16gb" narrows
  // rather than widening the way an OR match would.
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function compare(a: Product, b: Product, sort: SortOption): number {
  switch (sort) {
    case 'price-asc':
      return a.price - b.price;
    case 'price-desc':
      return b.price - a.price;
    case 'newest':
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    case 'featured':
    default:
      // Featured first, then by rating so the top of the grid is the strongest.
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return b.rating - a.rating;
  }
}

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  return products
    .filter((product) => {
      if (!matchesSearch(product, filters.search.trim())) return false;
      if (filters.categories.length && !filters.categories.includes(product.category)) return false;
      if (filters.tiers.length && !filters.tiers.includes(product.tier)) return false;
      if (filters.inStockOnly && product.stock <= 0) return false;
      if (filters.maxPrice !== null && product.price > filters.maxPrice) return false;
      return true;
    })
    .sort((a, b) => compare(a, b, filters.sort));
}

export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export function paginate<T>(items: T[], page: number, perPage: number): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  // Guard against a page number left over from a wider result set.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    page: safePage,
    totalPages,
    totalItems,
  };
}
