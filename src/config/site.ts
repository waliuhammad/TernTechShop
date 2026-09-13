/**
 * Brand, navigation and standing copy.
 *
 * Everything here is verbatim from the reference storefront. Centralised so the
 * "hardware deployment terminal" voice stays consistent and a wording change is
 * a one-line edit rather than a search across components.
 */

export const siteConfig = {
  name: 'Tern Technologies',
  shortName: 'TernTech',
  /** Canonical origin used for pre-rendered pages, the sitemap and structured data. */
  url: 'https://terntechshop.com',
  /** Split for the two-tone wordmark: bold italic + regular accent. */
  wordmark: { lead: 'Tern', accent: 'Technologies' },
  tagline: 'Industrial Hardware Distribution',
  description:
    'Industrial grade hardware solutions for enterprise-scale deployments and high-performance computing systems. Engineered for reliability, delivered all over Pakistan.',
  contact: {
    email: 'info@terntechshop.com',
    phone: '0316458 7553',
    phoneFormatted: '0316-4587553',
    addressShort: 'Office No. 11, Muhammadi Plaza,',
    address: 'Office No. 11, Muhammadi Plaza, Jinnah Avenue, Blue Area, F-6/1, Islamabad',
    addressCompact: 'Office No. 11, Muhammadi Plaza, Jinnah Avenue, Blue Area, Islamabad',
    city: 'Islamabad',
    country: 'Pakistan',
  },
  legalEntity: 'Tern Technologies Distribution Group',
  copyrightSuffix: 'All Protocols Reserved.',
} as const;

/** Primary header navigation. */
export const mainNav = [
  { name: 'Hardware', path: '/shop' },
  { name: 'Logistics', path: '/shipping' },
  { name: 'Warranty', path: '/warranty' },
  { name: 'About', path: '/about' },
] as const;

export const footerNav = {
  registryHub: {
    title: 'Registry Hub',
    links: [
      { name: 'Full Inventory Manifest', href: '/inventory' },
      { name: 'Computing Units', href: '/shop?category=Processors' },
      { name: 'Networking Nodes', href: '/shop?category=Networking' },
      { name: 'Data Storage Modules', href: '/shop?category=Storage' },
    ],
  },
  supportProtocol: {
    title: 'Support Protocol',
    links: [
      { name: 'Technical Heritage', href: '/about' },
      { name: 'Contact Engineer', href: '/contact' },
      { name: 'Logistics & Deployment', href: '/shipping' },
      { name: 'Warranty Registry', href: '/warranty' },
      { name: 'Return Policy', href: '/legal#returns' },
    ],
  },
  legal: [
    { name: 'Infrastructure Terms', href: '/legal#terms' },
    { name: 'Privacy Encryption', href: '/legal#privacy' },
    { name: 'Cookie Policy', href: '/legal#cookies' },
  ],
} as const;

/** The four catalog tiers, in ascending capability. */
export const performanceTiers = [
  {
    key: 'ESSENTIAL',
    label: 'Essential',
    iconKey: 'zap',
    colorClass: 'bg-blue-500',
    description: 'Optimized for personal workstations and small-scale operations.',
  },
  {
    key: 'PROFESSIONAL',
    label: 'Professional',
    iconKey: 'gauge',
    colorClass: 'bg-cyan-500',
    description: 'Balanced performance for high-load technical workflows.',
  },
  {
    key: 'ENTERPRISE',
    label: 'Enterprise',
    iconKey: 'server',
    colorClass: 'bg-emerald-500',
    description: 'Industrial grade hardware for mission-critical infrastructure.',
  },
  {
    key: 'EXTREME',
    label: 'Extreme',
    iconKey: 'flame',
    colorClass: 'bg-orange-500',
    description: 'Maximum throughput and extreme performance for high-end systems.',
  },
] as const;

/** Homepage "Built for Enterprise Execution" pillars. */
export const enterpriseFeatures = [
  { iconKey: 'shield', title: 'Secure-Boot', description: 'Hardware-level authentication and encryption.' },
  { iconKey: 'zap', title: 'Optimized Latency', description: 'Low-response rate hardware configurations.' },
  { iconKey: 'globe', title: 'Nationwide Logistics', description: 'Delivery all over Pakistan with reliable supply chains.' },
  { iconKey: 'activity', title: 'Uptime Monitor', description: 'Predictive analytics for component health.' },
] as const;

/** Hero trust strip. */
export const heroStats = [
  { iconKey: 'shield', value: 'Enterprise', label: 'Security Grade' },
  { iconKey: 'zap', value: '24/7', label: 'Support Tech' },
  { iconKey: 'globe', value: 'Pakistan', label: 'Wide Delivery' },
] as const;

/** Partner strip beneath the tier section. */
export const brandStrip = ['INTEL_CO', 'AMD_RZN', 'NVIDIA_G', 'ASUS_ROG', 'CORSAIR_V'] as const;

/** Catalog sort options, matching the reference's select. */
export const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
] as const;

export type SortOption = (typeof sortOptions)[number]['value'];

/** Contact form subjects. */
export const contactSubjects = [
  'Bulk Deployment Query',
  'Technical Implementation Hub',
  'Warranty Claim Escalation',
  'Other / General',
] as const;

export const PRODUCTS_PER_PAGE = 12;
