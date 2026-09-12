import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, later utilities winning over earlier conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL-safe slug: "Graphics Cards" -> "graphics-cards". */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

/**
 * The short hex shown as `Unit_ID: 69f21a9a` on the product page. Derived from
 * the product id so it is stable across renders and server/client boundaries.
 */
export function unitId(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date);
}
