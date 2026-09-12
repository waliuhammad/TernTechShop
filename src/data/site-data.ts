import type { Coupon, Review, ShippingZone } from '@/types';

/** The three sectors published on /shipping. */
export const shippingZones: ShippingZone[] = [
  { sector: 'Islamabad / Rawalpindi', deliveryWindow: '1-2 Days', carrier: 'Same-Day Express' },
  { sector: 'Lahore / Karachi / Peshawar', deliveryWindow: '2-3 Days', carrier: 'TCS / Leopard' },
  { sector: 'All Other Cities', deliveryWindow: '3-5 Days', carrier: 'M&P / PostEx' },
];

/** Logistics settings. Amounts in paisa. */
export const logistics = {
  /** Flat fee applied below the free-shipping threshold. */
  standardFee: 250 * 100,
  /** Order subtotal at or above which logistics are free. */
  freeThreshold: 5000 * 100,
} as const;

export const shippingAssurances = [
  {
    iconKey: 'package',
    title: 'Static Shielding',
    description: 'Every unit is encased in premium ESD-shielded vacuum packaging.',
  },
  {
    iconKey: 'shield-check',
    title: 'Real-time Check',
    description: 'Verification of thermal pads and physical pins prior to departure.',
  },
  {
    iconKey: 'map-pin',
    title: 'Tracked Arrival',
    description: 'Express air freight with end-to-end satellite tracking enabled.',
  },
] as const;

export const warrantyBenefits = [
  {
    iconKey: 'shield',
    title: 'Anti-Tamper Protocol',
    description:
      'Registration enables the digital signature for your hardware, protecting you against counterfeit units and ensuring genuine driver access.',
  },
  {
    iconKey: 'zap',
    title: 'Priority RMA',
    description:
      'Registered users receive expedited access to our specialized engineering team for troubleshooting and hardware replacements.',
  },
] as const;

/** Demo coupons. Validation lives in @/lib/coupons. */
export const coupons: Coupon[] = [
  {
    code: 'DEPLOY10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 20000 * 100,
    maxDiscountAmount: 15000 * 100,
    description: '10% off manifests above Rs. 20,000 (max Rs. 15,000 off).',
  },
  {
    code: 'LOGISTICS500',
    type: 'fixed',
    value: 500 * 100,
    minOrderAmount: 10000 * 100,
    description: 'Rs. 500 off manifests above Rs. 10,000.',
  },
];

/** Sample feedback rendered on product pages. */
export const reviews: Review[] = [
  {
    id: 'r-01',
    productId: 'p-cpu-01',
    author: 'Bilal Ahmed',
    rating: 5,
    body: 'Running sustained all-core compile loads for three weeks now. Thermals stable at 78C under a 360mm AIO. Packaging was properly ESD shielded.',
    date: '2026-06-02',
  },
  {
    id: 'r-02',
    productId: 'p-cpu-01',
    author: 'Hamza Sheikh',
    rating: 4,
    body: 'Excellent throughput but the 170W draw is real. Budget for cooling properly or you will thermal throttle in a cramped chassis.',
    date: '2026-05-18',
  },
  {
    id: 'r-03',
    productId: 'p-gpu-01',
    author: 'Ayesha Khan',
    rating: 5,
    body: 'Deployed into a render node. The 16GB clears our scene memory ceiling comfortably. Delivered to Islamabad in two days.',
    date: '2026-06-21',
  },
  {
    id: 'r-04',
    productId: 'p-st-01',
    author: 'Usman Tariq',
    rating: 5,
    body: 'Sustained write performance holds up far better than the drive it replaced. Sequential numbers match the rating on our bench.',
    date: '2026-04-11',
  },
  {
    id: 'r-05',
    productId: 'p-st-01',
    author: 'Fatima Noor',
    rating: 5,
    body: 'Third unit sourced from Tern. Consistent genuine stock and the serial registered against the warranty portal without issue.',
    date: '2026-03-27',
  },
  {
    id: 'r-06',
    productId: 'p-pr-01',
    author: 'Daniyal Raza',
    rating: 5,
    body: 'Quiet actuation makes a real difference in a shared office. Battery has gone six weeks on the first charge.',
    date: '2026-05-09',
  },
  {
    id: 'r-07',
    productId: 'p-nw-01',
    author: 'Saad Mehmood',
    rating: 5,
    body: 'PoE budget handled twelve access points with headroom. Layer 3 routing configured cleanly through the controller.',
    date: '2026-06-14',
  },
  {
    id: 'r-08',
    productId: 'p-mb-01',
    author: 'Zainab Iqbal',
    rating: 4,
    body: 'VRM stays cool under load. Four M.2 sockets was the deciding factor for our storage layout.',
    date: '2026-04-30',
  },
];

export function reviewsForProduct(productId: string): Review[] {
  return reviews.filter((review) => review.productId === productId);
}

/** /legal sections. `id` is the anchor target used by the footer links. */
export const legalSections = [
  {
    id: 'terms',
    title: 'Infrastructure Terms',
    body: 'By engaging with Tern Technologies, you agree to our structural governance standards. We provide computational components as-is, subject to valid registry through our warranty portal.',
    points: [
      'Use of hardware for high-frequency trading or massive server clusters requires an Enterprise License.',
      'Modifications to physical silicon void the System Safety Guarantee instantly.',
      'Bulk deployment pricing is quoted per manifest and is valid for fourteen days from issue.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Encryption',
    body: 'We treat your data with the same precision as our micro-architectures. All connection logs are encrypted with AES-256 standards at the node level.',
    quote:
      'Tern Technologies does not sell, lease, or distribute identity manifests to third-party data aggregators. Ever.',
    points: [
      'Deployment addresses are retained only as long as required to complete logistics and honour warranty claims.',
      'Payment is collected on delivery; we never store card credentials on our infrastructure.',
    ],
  },
  {
    id: 'returns',
    title: 'Return Policy',
    body: 'We want you to be completely satisfied with your purchase. If you are not happy with your order, please review our return guidelines below.',
    points: [
      'Returns are accepted within 7 days of delivery, in original ESD packaging with all accessories.',
      'Defective or incorrectly shipped items are replaced or refunded in full, including logistics.',
      'Non-returnable: opened thermal compound, and any component with physical or liquid damage.',
      'To initiate a return, email info@terntechshop.com quoting your Manifest ID.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookie Policy',
    body: 'Our interface uses strictly necessary tokens to maintain your session state. We do not use persistent tracking cookies or shadow profiles.',
    points: [
      'Your hardware cart and watchlist are stored locally in your own browser, never on our servers.',
      'Clearing your browser storage will clear both.',
    ],
  },
] as const;

/** /about narrative blocks. */
export const heritageBlocks = [
  {
    title: 'The Silicon Foundation',
    body: 'Tern Technologies began in a small research lab focused on thermal dissipation in microconductors. Our first patents in liquid cooling changed the industry standard for server-grade stability.',
  },
  {
    title: 'Pakistan Infrastructure',
    body: 'Today, our components power everything from boutique gaming rigs to massive neural network training clusters all over Pakistan. We believe that access to extreme hardware should be seamless and dependable.',
  },
] as const;
