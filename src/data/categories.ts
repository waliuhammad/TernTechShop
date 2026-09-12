import type { Category } from '@/types';

/**
 * The six departments shown on the homepage grid and the shop sidebar.
 * `colorHex` drives the category card accent; `iconKey` is resolved by
 * `@/lib/icons`.
 */
export const categories: Category[] = [
  {
    name: 'Processors',
    slug: 'processors',
    iconKey: 'cpu',
    colorHex: '#3b82f6',
    tagline: 'Computing Units',
    description: 'Desktop and server-class silicon for every workload tier.',
  },
  {
    name: 'Graphics Cards',
    slug: 'graphics-cards',
    iconKey: 'monitor',
    colorHex: '#06b6d4',
    tagline: 'Render Engines',
    description: 'Discrete accelerators for rendering, simulation and training.',
  },
  {
    name: 'Motherboards',
    slug: 'motherboards',
    iconKey: 'circuit-board',
    colorHex: '#8b5cf6',
    tagline: 'System Boards',
    description: 'Chipset platforms engineered for stable sustained load.',
  },
  {
    name: 'Storage',
    slug: 'storage',
    iconKey: 'hard-drive',
    colorHex: '#10b981',
    tagline: 'Data Storage Modules',
    description: 'NVMe, SATA and enterprise drives rated for endurance.',
  },
  {
    name: 'Peripherals',
    slug: 'peripherals',
    iconKey: 'mouse-pointer',
    colorHex: '#f43f5e',
    tagline: 'Interface Hardware',
    description: 'Input and output hardware built for long operator sessions.',
  },
  {
    name: 'Networking',
    slug: 'networking',
    iconKey: 'network',
    colorHex: '#f59e0b',
    tagline: 'Networking Nodes',
    description: 'Switching, routing and interface cards for dense racks.',
  },
];

export const categoryNames = categories.map((category) => category.name);

export function findCategory(name: string): Category | undefined {
  return categories.find((category) => category.name === name);
}
