/**
 * A catalog department's display name. Categories are managed from the admin
 * panel, so this is any string rather than a fixed list.
 */
export type CategoryName = string;

/** The four catalog tiers, ascending in capability. */
export type PerformanceTier = 'Essential' | 'Professional' | 'Enterprise' | 'Extreme';

export interface Category {
  name: CategoryName;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
  /** Lucide icon key resolved by `resolveIcon`. */
  iconKey: string;
  colorHex: string;
  tagline: string;
  description: string;
}

export interface Specification {
  label: string;
  value: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  date: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  category: CategoryName;
  tier: PerformanceTier;

  /** All money is an integer count of paisa (1/100 PKR). Never a float. */
  price: number;
  /** Original price when discounted. Absent means not on sale. */
  compareAtPrice?: number;

  shortDescription: string;
  description: string;
  highlights: string[];
  specifications: Specification[];
  images: string[];

  stock: number;
  isFeatured: boolean;
  isNew: boolean;
  /** False once archived from the admin panel. The storefront only loads active products. */
  isActive?: boolean;
  rating: number;
  reviewCount: number;
  /** ISO date, drives the "Newest" sort. */
  addedAt: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

/** A cart line joined to its product, with totals resolved. */
export interface ResolvedCartLine {
  product: Product;
  quantity: number;
  lineTotal: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  freeShippingShortfall: number;
}

export interface ShippingDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

export interface ShippingZone {
  sector: string;
  deliveryWindow: string;
  carrier: string;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  /** Whole percentage points, or minor units for a fixed discount. */
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  description: string;
  isActive?: boolean;
}
