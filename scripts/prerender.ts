/**
 * Static pre-rendering for search engines and link previews.
 *
 * Runs after `vite build` (see the `build` script). The storefront is a
 * client-rendered SPA, so without this every URL serves the same empty
 * index.html and a crawler that doesn't execute JavaScript sees no products.
 *
 * For every public page and every active product this writes an HTML file with
 * the page's own <title>, description, canonical URL, Open Graph tags,
 * structured data, and a plain-HTML copy of the content inside #root. React
 * replaces that copy as soon as the app starts (and a class set in <head> hides
 * it until then), so visitors see exactly the same site as before.
 *
 *   dist/index.html              home
 *   dist/shop.html, about.html…  information and catalog pages
 *   dist/product/<slug>.html     one per active product
 *   dist/app.html                the untouched SPA shell (cart, account, admin…)
 *   dist/sitemap.xml, robots.txt
 *
 * public/.htaccess maps /shop to shop.html and everything else to app.html.
 *
 * Product data is read from Firestore's public REST API — the same data the
 * site shows — so redeploying on Hostinger refreshes these pages. If Firestore
 * is unreachable, product pages are skipped (never rendered from stale bundled
 * prices) and the site still works exactly as a normal SPA.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { categories as bundledCategories } from '../src/data/categories';
import { heritageBlocks, legalSections, logistics, shippingZones, warrantyBenefits } from '../src/data/site-data';
import { siteConfig } from '../src/config/site';
import type { Category, Product, ShippingZone } from '../src/types';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const env = { ...loadEnv('production', ROOT, 'VITE_'), ...process.env };
const SITE_URL = (env.SITE_URL ?? siteConfig.url).replace(/\/$/, '');
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;

// ---------------------------------------------------------------------------
// Firestore REST
// ---------------------------------------------------------------------------

type FirestoreValue = Record<string, unknown>;

function decode(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: FirestoreValue[] }).values ?? [];
    return values.map(decode);
  }
  if ('mapValue' in value) return decodeFields((value.mapValue as { fields?: Record<string, FirestoreValue> }).fields);
  return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

const API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function runQuery(collectionId: string, where?: FirestoreValue) {
  const response = await fetch(`${API}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...(where ? { where } : {}) } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${collectionId}: HTTP ${response.status}`);
  const rows = (await response.json()) as Array<{ document?: { name: string; fields?: Record<string, FirestoreValue> } }>;
  return rows
    .filter((row) => row.document)
    .map((row) => ({ id: row.document!.name.split('/').pop()!, data: decodeFields(row.document!.fields) }));
}

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

async function loadLiveCatalog(): Promise<{ products: Product[]; categories: Category[] } | null> {
  if (!PROJECT_ID) {
    console.warn('  prerender: VITE_FIREBASE_PROJECT_ID not set — product pages skipped.');
    return null;
  }
  try {
    const [productRows, categoryRows] = await Promise.all([
      runQuery('products', {
        fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } },
      }),
      runQuery('categories'),
    ]);

    const products: Product[] = productRows
      .map(({ id, data }) => ({
        id,
        slug: str(data.slug),
        name: str(data.name),
        sku: str(data.sku),
        brand: str(data.brand),
        category: str(data.category),
        tier: str(data.tier, 'Essential') as Product['tier'],
        price: num(data.price),
        compareAtPrice: typeof data.compareAtPrice === 'number' ? data.compareAtPrice : undefined,
        shortDescription: str(data.shortDescription),
        description: str(data.description),
        highlights: Array.isArray(data.highlights) ? data.highlights.map(String) : [],
        specifications: Array.isArray(data.specifications)
          ? (data.specifications as Array<Record<string, unknown>>).map((spec) => ({
              label: str(spec?.label),
              value: str(spec?.value),
            }))
          : [],
        images: Array.isArray(data.images) ? data.images.map(String) : [],
        stock: num(data.stock),
        isFeatured: data.isFeatured === true,
        isNew: data.isNew === true,
        isActive: true,
        rating: num(data.rating),
        reviewCount: num(data.reviewCount),
        addedAt: str(data.addedAt),
      }))
      .filter((product) => /^[a-z0-9-]+$/.test(product.slug) && product.name && product.price > 0);

    const categories: Category[] = categoryRows
      .map(({ id, data }) => ({
        name: str(data.name),
        slug: str(data.slug, id),
        sortOrder: num(data.sortOrder, 999),
        isActive: data.isActive !== false,
        iconKey: str(data.iconKey),
        colorHex: str(data.colorHex),
        tagline: str(data.tagline),
        description: str(data.description),
      }))
      .filter((category) => category.name && category.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return { products, categories };
  } catch (error) {
    console.warn(`  prerender: Firestore unreachable (${(error as Error).message}) — product pages skipped.`);
    return null;
  }
}

async function loadShipping(): Promise<{ fee: number; threshold: number; zones: ShippingZone[] }> {
  const fallback = { fee: logistics.standardFee, threshold: logistics.freeThreshold, zones: shippingZones };
  if (!PROJECT_ID) return fallback;
  try {
    const response = await fetch(`${API}/settings/logistics`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return fallback;
    const data = decodeFields(((await response.json()) as { fields?: Record<string, FirestoreValue> }).fields);
    const zones = Array.isArray(data.zones)
      ? (data.zones as Array<Record<string, unknown>>)
          .map((zone) => ({ sector: str(zone?.sector), deliveryWindow: str(zone?.deliveryWindow), carrier: str(zone?.carrier) }))
          .filter((zone) => zone.sector)
      : [];
    return {
      fee: num(data.standardShippingFee, fallback.fee),
      threshold: num(data.freeShippingThreshold, fallback.threshold),
      zones: zones.length ? zones : fallback.zones,
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON inside <script> must not be able to close the tag. */
const jsonLd = (data: unknown, url: string) =>
  `<script type="application/ld+json" data-prerender-ld data-path="${url}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const rupees = (paisa: number) => `Rs. ${Math.round(paisa / 100).toLocaleString('en-US')}`;
const shopLink = (category: string) => `/shop?category=${encodeURIComponent(category)}`;
const clip = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

interface PageSpec {
  /** Root-relative URL, e.g. "/shop". */
  url: string;
  /** Output file relative to dist. */
  file: string;
  title: string;
  description: string;
  image?: string;
  ogType?: string;
  structuredData?: unknown[];
  body: string;
}

function renderPage(template: string, page: PageSpec, nav: string): string {
  const canonical = `${SITE_URL}${page.url === '/' ? '/' : page.url}`;
  const head = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${page.ogType ?? 'website'}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteConfig.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    page.image ? `<meta property="og:image" content="${escapeHtml(page.image)}" />` : '',
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`,
    ...(page.structuredData ?? []).map((data) => jsonLd(data, page.url)),
  ]
    .filter(Boolean)
    .join('\n    ');

  const withoutDefaults = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace(/<link\s+rel="canonical"[\s\S]*?\/>\s*/, '')
    .replace(/<meta\s+property="og:[a-z_]+"[\s\S]*?\/>\s*/g, '')
    .replace(/<meta\s+name="twitter:[a-z_]+"[\s\S]*?\/>\s*/g, '');

  const content = `<div data-prerender>${nav}<main>${page.body}</main>${footer()}</div>`;

  if (!withoutDefaults.includes('<div id="root"></div>')) throw new Error('#root not found in built index.html');
  return withoutDefaults
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

function footer(): string {
  const { contact } = siteConfig;
  return `<footer><p>${escapeHtml(siteConfig.name)} — ${escapeHtml(contact.address)}. Phone ${escapeHtml(
    contact.phoneFormatted,
  )}. Email <a href="mailto:${contact.email}">${contact.email}</a>.</p></footer>`;
}

function productList(products: Product[]): string {
  return `<ul>${products
    .map(
      (product) =>
        `<li><a href="/product/${product.slug}">${escapeHtml(product.name)}</a> — ${rupees(product.price)}${
          product.stock > 0 ? '' : ' (out of stock)'
        }</li>`,
    )
    .join('')}</ul>`;
}

function productJsonLd(product: Product) {
  const url = `${SITE_URL}/product/${product.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.shortDescription,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand },
    category: product.category,
    url,
    ...(product.reviewCount > 0 && product.rating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount } }
      : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'PKR',
      price: (product.price / 100).toFixed(0),
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: siteConfig.name },
    },
  };
}

function breadcrumbs(items: Array<[string, string]>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${SITE_URL}${url}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const titleFor = (title: string) => `${title} | ${siteConfig.shortName}`;

async function main() {
  const indexPath = path.join(DIST, 'index.html');
  if (!existsSync(indexPath)) throw new Error('dist/index.html not found — run vite build first.');
  const template = readFileSync(indexPath, 'utf8');

  // The SPA shell for every route that isn't pre-rendered (cart, account,
  // admin, products added since the last deploy…).
  writeFileSync(path.join(DIST, 'app.html'), template);

  const [catalog, shipping] = await Promise.all([loadLiveCatalog(), loadShipping()]);
  const products = catalog?.products ?? [];
  const categories = catalog?.categories.length ? catalog.categories : bundledCategories;
  const byCategory = (name: string) => products.filter((product) => product.category === name);

  const nav = `<nav aria-label="Main"><a href="/">${escapeHtml(siteConfig.name)}</a> · <a href="/shop">Hardware</a> · ${categories
    .map((category) => `<a href="${shopLink(category.name)}">${escapeHtml(category.name)}</a>`)
    .join(' · ')} · <a href="/shipping">Logistics</a> · <a href="/warranty">Warranty</a> · <a href="/about">About</a> · <a href="/contact">Contact</a></nav>`;

  const catalogSections = categories
    .map((category) => {
      const items = byCategory(category.name);
      if (catalog && items.length === 0) return '';
      return `<section><h2><a href="${shopLink(category.name)}">${escapeHtml(category.name)}</a></h2><p>${escapeHtml(
        category.description || category.tagline,
      )}</p>${items.length ? productList(items) : ''}</section>`;
    })
    .join('');

  const pages: PageSpec[] = [
    {
      url: '/',
      file: 'index.html',
      title: `${siteConfig.name} — ${siteConfig.tagline}`,
      description: siteConfig.description,
      structuredData: [
        { '@context': 'https://schema.org', '@type': 'WebSite', name: siteConfig.name, url: `${SITE_URL}/` },
      ],
      body: `<h1>Performance Refined.</h1><p>${escapeHtml(siteConfig.description)}</p>${
        products.some((product) => product.isFeatured)
          ? `<section><h2>Featured hardware</h2>${productList(products.filter((product) => product.isFeatured))}</section>`
          : ''
      }${catalogSections}`,
    },
    {
      url: '/shop',
      file: 'shop.html',
      title: titleFor('Hardware Manifest'),
      description:
        'Browse the full registry of industrial-grade components, processors, graphics cards and enterprise networking hardware.',
      structuredData: products.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: products.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${SITE_URL}/product/${product.slug}`,
                name: product.name,
              })),
            },
          ]
        : [],
      body: `<h1>Hardware Manifest</h1><p>Browse the full registry of industrial-grade components.</p>${catalogSections}`,
    },
    {
      url: '/inventory',
      file: 'inventory.html',
      title: titleFor('Full Inventory Manifest'),
      description: 'Complete registry of every indexed hardware unit with live stock levels.',
      body: `<h1>Full Inventory Manifest</h1>${catalogSections}`,
    },
    {
      url: '/shipping',
      file: 'shipping.html',
      title: titleFor('Logistics & Deployment'),
      description:
        'Nationwide distribution networks engineered for speed and hardware integrity, delivering all over Pakistan.',
      body: `<h1>Logistics &amp; Deployment</h1><p>Delivery all over Pakistan. Standard shipping ${rupees(
        shipping.fee,
      )}; free on orders from ${rupees(shipping.threshold)}.</p><table><thead><tr><th>Sector</th><th>Delivery</th><th>Carrier</th></tr></thead><tbody>${shipping.zones
        .map(
          (zone) =>
            `<tr><td>${escapeHtml(zone.sector)}</td><td>${escapeHtml(zone.deliveryWindow)}</td><td>${escapeHtml(zone.carrier)}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    },
    {
      url: '/warranty',
      file: 'warranty.html',
      title: titleFor('Warranty Registry'),
      description: 'Extended protection and authentication for your Tern hardware assets.',
      body: `<h1>Warranty Registry</h1><p>Extended protection and authentication for your Tern hardware assets.</p>${warrantyBenefits
        .map((benefit) => `<h2>${escapeHtml(benefit.title)}</h2><p>${escapeHtml(benefit.description)}</p>`)
        .join('')}`,
    },
    {
      url: '/about',
      file: 'about.html',
      title: titleFor('Technical Heritage'),
      description: 'Forging the future of high-performance computing through decades of engineering excellence.',
      body: `<h1>Technical Heritage</h1>${heritageBlocks
        .map((block) => `<h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.body)}</p>`)
        .join('')}`,
    },
    {
      url: '/contact',
      file: 'contact.html',
      title: titleFor('Contact Engineer'),
      description:
        'Direct access to our hardware engineering team for specialized implementation support and bulk manifest inquiries.',
      body: `<h1>Contact Engineer</h1><p>Direct access to our hardware engineering team for implementation support and bulk inquiries.</p>`,
    },
    {
      url: '/legal',
      file: 'legal.html',
      title: titleFor('Legal Compliance Center'),
      description: 'Governance of our hardware distribution network and digital infrastructure.',
      body: `<h1>Legal Compliance Center</h1>${legalSections
        .map(
          (section) =>
            `<section id="${section.id}"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p><ul>${section.points
              .map((point) => `<li>${escapeHtml(point)}</li>`)
              .join('')}</ul></section>`,
        )
        .join('')}`,
    },
  ];

  for (const product of products) {
    const related = products.filter((other) => other.category === product.category && other.id !== product.id).slice(0, 4);
    pages.push({
      url: `/product/${product.slug}`,
      file: `product/${product.slug}.html`,
      title: titleFor(product.name),
      description: clip(product.shortDescription || product.description || product.name),
      image: product.images[0],
      ogType: 'product',
      structuredData: [
        productJsonLd(product),
        breadcrumbs([
          ['Hardware', '/shop'],
          [product.category, shopLink(product.category)],
          [product.name, `/product/${product.slug}`],
        ]),
      ],
      body: `<nav aria-label="Breadcrumb"><a href="/shop">Hardware</a> › <a href="${shopLink(product.category)}">${escapeHtml(
        product.category,
      )}</a></nav><h1>${escapeHtml(product.name)}</h1>${
        product.images[0] ? `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}" width="600" />` : ''
      }<p>${escapeHtml(product.brand)} · SKU ${escapeHtml(product.sku)} · ${escapeHtml(product.tier)}</p><p><strong>${rupees(
        product.price,
      )}</strong>${
        product.compareAtPrice ? ` <s>${rupees(product.compareAtPrice)}</s>` : ''
      } — ${product.stock > 0 ? 'In stock' : 'Out of stock'}</p><p>${escapeHtml(product.shortDescription)}</p>${
        product.highlights.length ? `<ul>${product.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''
      }${
        product.specifications.length
          ? `<h2>Specifications</h2><table><tbody>${product.specifications
              .map((spec) => `<tr><th>${escapeHtml(spec.label)}</th><td>${escapeHtml(spec.value)}</td></tr>`)
              .join('')}</tbody></table>`
          : ''
      }${product.description ? `<h2>Description</h2><p>${escapeHtml(product.description)}</p>` : ''}${
        related.length ? `<h2>Related hardware</h2>${productList(related)}` : ''
      }`,
    });
  }

  for (const page of pages) {
    const target = path.join(DIST, page.file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, renderPage(template, page, nav));
  }

  // No <lastmod>: products don't record when they were last edited, and a
  // guessed date is worse than none (search engines ignore inaccurate ones).
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((page) => `  <url><loc>${SITE_URL}${page.url}</loc></url>`)
  .join('\n')}
</urlset>
`;
  writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

  writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /cart
Disallow: /checkout
Disallow: /orders
Disallow: /order-confirmation/
Disallow: /wishlist
Disallow: /login

Sitemap: ${SITE_URL}/sitemap.xml
`,
  );

  console.log(
    `  prerender: ${pages.length} pages (${products.length} products${catalog ? '' : ', Firestore skipped'}), sitemap.xml, robots.txt`,
  );
}

main().catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});
