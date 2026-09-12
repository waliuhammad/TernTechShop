import type { Coupon, ShippingZone } from '@/types';

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
