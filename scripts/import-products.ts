/**
 * Imports products from product-assets/ into the store.
 *
 * Each folder in product-assets/ is one product: its photos, the owner's
 * info.txt (price, stock, notes) and a product.json describing the listing.
 * See product-assets/README.md for the workflow.
 *
 *   npm run import-products                      # check only: uploads and writes nothing
 *   npm run import-products -- --commit          # upload photos + create/update products
 *   npm run import-products -- --only <folder>   # limit to one folder (combine with --commit)
 *
 * Live project: set GOOGLE_APPLICATION_CREDENTIALS to the service-account key.
 * Emulator:     set FIRESTORE_EMULATOR_HOST and FIREBASE_PROJECT_ID=demo-terntech.
 *
 * Runs through the Admin SDK (rules don't apply), so it re-checks everything
 * firestore.rules would require of a product before writing.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { applicationDefault, cert, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { loadEnv } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const onlyIndex = args.indexOf('--only');
const ONLY = onlyIndex === -1 ? null : args[onlyIndex + 1] ?? '';
const dirIndex = args.indexOf('--dir');
const ASSETS = path.resolve(ROOT, dirIndex === -1 ? 'product-assets' : args[dirIndex + 1] ?? 'product-assets');

const env = { ...loadEnv('production', ROOT, 'VITE_'), ...process.env };
const CLOUD_NAME = env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = env.CLOUDINARY_UPLOAD_URL ?? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const IMAGE_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 12;
const TIERS = ['Essential', 'Professional', 'Enterprise', 'Extreme'] as const;

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

function createApp(): App {
  const projectId = env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID;
  if (env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId });
  const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    if (!existsSync(keyPath)) {
      console.error(`Service-account key not found at:\n  ${keyPath}`);
      process.exit(1);
    }
    return initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))), projectId });
  }
  return initializeApp({ credential: applicationDefault(), projectId });
}

// ---------------------------------------------------------------------------
// Reading a folder
// ---------------------------------------------------------------------------

interface ProductJson {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  category: string;
  tier: (typeof TIERS)[number];
  /** Rupees, as written by a person. Stored as paisa. null = still waiting for a verified price. */
  price: number | null;
  compareAtPrice?: number | null;
  stock: number;
  shortDescription: string;
  description: string;
  highlights: string[];
  specifications: Array<{ label: string; value: string }>;
  isFeatured?: boolean;
  isNew?: boolean;
  isActive?: boolean;
}

interface UploadCache {
  [file: string]: { sha1: string; url: string };
}

/** "price: 45,000" lines -> { price: "45,000" }. */
function readInfo(folder: string): Record<string, string> {
  const file = path.join(folder, 'info.txt');
  if (!existsSync(file)) return {};
  const info: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const match = line.match(/^\s*([a-z ]+?)\s*:\s*(.*)$/i);
    if (match?.[1] && match[2]?.trim()) info[match[1].toLowerCase()] = match[2].trim();
  }
  return info;
}

const rupeeNumber = (value: string | undefined) => (value ? Number(value.replace(/[^\d.]/g, '')) : NaN);

function listImages(folder: string): string[] {
  return readdirSync(folder)
    .filter((file) => IMAGE_TYPES[path.extname(file).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

type PricedProduct = ProductJson & { price: number };

function problemsWith(product: PricedProduct, images: string[], folder: string, info: Record<string, string>): string[] {
  const problems: string[] = [];
  const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

  if (!text(product.name, 2, 200)) problems.push('name must be 2–200 characters');
  if (!text(product.slug, 2, 200) || !/^[a-z0-9-]+$/.test(product.slug)) problems.push('slug must be lowercase letters, digits and dashes');
  if (!text(product.sku, 1, 60)) problems.push('sku must be 1–60 characters');
  if (!text(product.brand, 1, 80)) problems.push('brand is required');
  if (!text(product.category, 2, 60)) problems.push('category is required');
  if (!TIERS.includes(product.tier)) problems.push(`tier must be one of ${TIERS.join(', ')}`);
  if (!Number.isInteger(product.price) || product.price <= 0) problems.push('price must be a whole number of rupees above 0');
  if (product.compareAtPrice != null && (!Number.isInteger(product.compareAtPrice) || product.compareAtPrice <= product.price)) {
    problems.push('compareAtPrice must be a whole number above price, or null');
  }
  if (!Number.isInteger(product.stock) || product.stock < 0 || product.stock > 100000) problems.push('stock must be a whole number 0–100000');
  if (!text(product.shortDescription, 10, 300)) problems.push('shortDescription must be 10–300 characters');
  if (!text(product.description, 20, 5000)) problems.push('description must be 20–5000 characters');
  if (!Array.isArray(product.highlights) || product.highlights.some((item) => !text(item, 2, 200))) problems.push('highlights must be a list of short strings');
  if (!Array.isArray(product.specifications) || product.specifications.some((spec) => !text(spec?.label, 1, 80) || !text(spec?.value, 1, 300))) {
    problems.push('specifications must be a list of { label, value }');
  }

  if (images.length === 0) problems.push('no photos in the folder');
  if (images.length > MAX_IMAGES) problems.push(`${images.length} photos — the store allows ${MAX_IMAGES}`);
  for (const image of images) {
    const size = statSync(path.join(folder, image)).size;
    if (size > MAX_IMAGE_BYTES) problems.push(`${image} is ${(size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB`);
  }

  // The owner's info.txt is the source of truth for money and stock.
  const infoPrice = rupeeNumber(info.price);
  if (Number.isFinite(infoPrice) && infoPrice !== product.price) problems.push(`price ${product.price} does not match info.txt (${info.price})`);
  const infoStock = rupeeNumber(info.stock);
  if (Number.isFinite(infoStock) && infoStock !== product.stock) problems.push(`stock ${product.stock} does not match info.txt (${info.stock})`);
  const infoWas = rupeeNumber(info['compare at price']);
  if (Number.isFinite(infoWas) && infoWas !== product.compareAtPrice) problems.push(`compareAtPrice does not match info.txt (${info['compare at price']})`);

  return problems;
}

// ---------------------------------------------------------------------------
// Cloudinary
// ---------------------------------------------------------------------------

async function upload(folder: string, image: string, cache: UploadCache): Promise<string> {
  const bytes = readFileSync(path.join(folder, image));
  const sha1 = createHash('sha1').update(bytes).digest('hex');
  const cached = cache[image];
  if (cached?.sha1 === sha1) return cached.url;

  const body = new FormData();
  body.append('file', new Blob([bytes], { type: IMAGE_TYPES[path.extname(image).toLowerCase()] }), image);
  body.append('upload_preset', UPLOAD_PRESET ?? '');
  const response = await fetch(UPLOAD_URL, { method: 'POST', body });
  const payload = (await response.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !payload.secure_url) {
    throw new Error(`${image}: Cloudinary refused the upload (${payload.error?.message ?? `HTTP ${response.status}`})`);
  }
  // Same delivery transformation as uploads from the admin panel.
  const url = payload.secure_url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_1600/');
  cache[image] = { sha1, url };
  return url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const rupees = (value: number) => `Rs. ${value.toLocaleString('en-US')}`;

async function main() {
  if (!existsSync(ASSETS)) {
    console.error(`No ${path.relative(ROOT, ASSETS)} folder.`);
    process.exit(1);
  }

  const folders = readdirSync(ASSETS)
    .filter((name) => !name.startsWith('_') && !name.startsWith('.') && statSync(path.join(ASSETS, name)).isDirectory())
    .filter((name) => !ONLY || name === ONLY);

  if (folders.length === 0) {
    console.log(ONLY ? `No folder named "${ONLY}".` : 'No product folders yet. See product-assets/README.md.');
    return;
  }

  const db = getFirestore(createApp());
  const categorySnap = await db.collection('categories').get();
  const categories = new Map(categorySnap.docs.map((doc) => [String(doc.data().name), doc.data().isActive !== false]));

  let failed = 0;
  const ready: Array<{ folder: string; id: string; product: PricedProduct; images: string[]; exists: boolean }> = [];

  console.log(`${COMMIT ? 'IMPORTING' : 'CHECKING (nothing is uploaded or written — add --commit to import)'}\n`);

  for (const name of folders) {
    const folder = path.join(ASSETS, name);
    const id = `pa-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const jsonPath = path.join(folder, 'product.json');
    const images = listImages(folder);

    if (!existsSync(jsonPath)) {
      console.log(`  …  ${name}: waiting for product.json (${images.length} photo${images.length === 1 ? '' : 's'})`);
      continue;
    }

    let parsed: ProductJson;
    try {
      parsed = JSON.parse(readFileSync(jsonPath, 'utf8')) as ProductJson;
    } catch (error) {
      console.log(`  ✗  ${name}: product.json is not valid JSON — ${(error as Error).message}`);
      failed += 1;
      continue;
    }

    // A listing whose price hasn't been verified yet waits, rather than blocking
    // every other product. Add the price to product.json (and info.txt) to import it.
    if (parsed.price === null || parsed.price === undefined) {
      console.log(`  …  ${name}: waiting for a verified price (${parsed.name ?? 'unnamed'})`);
      continue;
    }
    const product = parsed as PricedProduct;

    const problems = problemsWith(product, images, folder, readInfo(folder));
    if (product.category && !categories.has(product.category)) {
      problems.push(`category "${product.category}" doesn't exist — use one of: ${[...categories.keys()].join(', ')}`);
    } else if (product.category && categories.get(product.category) === false) {
      problems.push(`category "${product.category}" is hidden in the store`);
    }

    const sameSlug = await db.collection('products').where('slug', '==', product.slug ?? '').get();
    if (sameSlug.docs.some((doc) => doc.id !== id)) problems.push(`another product already uses the URL /product/${product.slug}`);
    const exists = (await db.doc(`products/${id}`).get()).exists;

    if (problems.length) {
      console.log(`  ✗  ${name}`);
      for (const problem of problems) console.log(`       - ${problem}`);
      failed += 1;
      continue;
    }

    const sale = product.compareAtPrice ? ` (was ${rupees(product.compareAtPrice)})` : '';
    console.log(
      `  ✓  ${name}: ${exists ? 'UPDATE' : 'NEW'} · ${product.name} · ${product.category} · ${rupees(product.price)}${sale} · stock ${product.stock}${exists ? ' (live stock kept)' : ''} · ${images.length} photo${images.length === 1 ? '' : 's'}`,
    );
    ready.push({ folder, id, product, images, exists });
  }

  if (failed) {
    console.log(`\n${failed} folder${failed === 1 ? '' : 's'} need fixing. Nothing was imported.`);
    process.exitCode = 1;
    return;
  }
  if (!COMMIT || ready.length === 0) {
    if (ready.length) console.log(`\n${ready.length} product${ready.length === 1 ? '' : 's'} ready. Run again with --commit to import.`);
    return;
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error('\nVITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET must be set in .env to upload photos.');
    process.exitCode = 1;
    return;
  }

  console.log('');
  for (const { folder, id, product, images } of ready) {
    const cachePath = path.join(folder, '.uploads.json');
    const cache = (existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}) as UploadCache;

    const urls: string[] = [];
    try {
      for (const image of images) urls.push(await upload(folder, image, cache));
    } finally {
      // Save progress even if a later photo fails, so a retry skips finished ones.
      writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
    }

    const ref = db.doc(`products/${id}`);
    await db.runTransaction(async (tx) => {
      const existing = (await tx.get(ref)).data();
      tx.set(ref, {
        name: product.name.trim(),
        slug: product.slug,
        sku: product.sku.trim(),
        brand: product.brand.trim(),
        category: product.category,
        tier: product.tier,
        price: product.price * 100,
        compareAtPrice: product.compareAtPrice ? product.compareAtPrice * 100 : null,
        // Stock set in the store (sales, restocks) always wins over the file.
        stock: existing ? Number(existing.stock ?? product.stock) : product.stock,
        shortDescription: product.shortDescription.trim(),
        description: product.description.trim(),
        highlights: product.highlights,
        specifications: product.specifications,
        images: urls,
        isFeatured: product.isFeatured ?? false,
        isNew: product.isNew ?? true,
        isActive: product.isActive ?? true,
        rating: Number(existing?.rating ?? 0),
        reviewCount: Number(existing?.reviewCount ?? 0),
        addedAt: String(existing?.addedAt ?? new Date().toISOString().slice(0, 10)),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    console.log(`  ↑  ${product.name}: live at /product/${product.slug}`);
  }

  console.log(`\nImported ${ready.length} product${ready.length === 1 ? '' : 's'}.`);
  console.log('They are in the store now. Redeploy the website later so search engines and the sitemap include them.');
}

main().catch((error) => {
  console.error('Import failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
