/**
 * Uploads the bundled catalog into Firestore.
 *
 * Runs through the Admin SDK, which bypasses security rules — that is the
 * point, since firestore.rules deliberately forbids clients from writing
 * products. Nothing in here ever ships to the browser.
 *
 * Against the emulator (no credentials needed):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-terntech npm run seed
 *
 * Against your real project:
 *   1. Firebase Console -> Project settings -> Service accounts -> Generate new private key
 *   2. Save it OUTSIDE the repo (it is a full-access credential — never commit it)
 *   3. GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json FIREBASE_PROJECT_ID=your-project npm run seed
 *
 * Grant an admin (role only — does not touch the catalog):
 *   ... npm run seed -- --admin <firebase-auth-uid>
 */
import { cert, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { categories } from '../src/data/categories';
import { products } from '../src/data/products';
import { coupons, logistics } from '../src/data/site-data';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) {
  console.error('FIREBASE_PROJECT_ID is not set.');
  process.exit(1);
}

function createApp(): App {
  // The emulator accepts any credential, so skip the service account entirely.
  if (usingEmulator) return initializeApp({ projectId });

  if (credentialsPath) {
    if (!existsSync(credentialsPath)) {
      console.error(
        `Service-account key not found at:\n  ${credentialsPath}\n\n` +
          'Set GOOGLE_APPLICATION_CREDENTIALS to the full path of the JSON file downloaded from\n' +
          'Firebase Console -> Project settings -> Service accounts. It is usually in Downloads,\n' +
          'named like <project>-firebase-adminsdk-xxxxx.json.',
      );
      process.exit(1);
    }
    const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  return initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore(createApp());

/** Firestore rejects `undefined`; drop those keys rather than writing null. */
function defined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
}

async function seedCategories() {
  const batch = db.batch();
  categories.forEach((category, index) => {
    batch.set(db.collection('categories').doc(category.slug), {
      ...category,
      sortOrder: index,
      isActive: true,
    });
  });
  await batch.commit();
  console.log(`  categories: ${categories.length}`);
}

async function seedProducts() {
  // Firestore batches cap at 500 writes; chunk to stay well clear.
  const chunkSize = 400;
  for (let i = 0; i < products.length; i += chunkSize) {
    const batch = db.batch();
    for (const product of products.slice(i, i + chunkSize)) {
      batch.set(
        db.collection('products').doc(product.id),
        defined({
          slug: product.slug,
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          category: product.category,
          tier: product.tier,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          shortDescription: product.shortDescription,
          description: product.description,
          highlights: product.highlights,
          specifications: product.specifications,
          images: product.images,
          stock: product.stock,
          isFeatured: product.isFeatured,
          isNew: product.isNew,
          isActive: true,
          rating: product.rating,
          reviewCount: product.reviewCount,
          addedAt: product.addedAt,
        }),
      );
    }
    await batch.commit();
  }
  console.log(`  products: ${products.length}`);
}

async function seedCoupons() {
  const batch = db.batch();
  coupons.forEach((coupon) => {
    batch.set(
      db.collection('coupons').doc(coupon.code),
      defined({
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        description: coupon.description,
        isActive: true,
      }),
    );
  });
  await batch.commit();
  console.log(`  coupons: ${coupons.length}`);
}

async function seedSettings() {
  // Mirrors the constants compiled into firestore.rules. Changing the fee here
  // alone will NOT change what the rules accept — update both together.
  await db.collection('settings').doc('logistics').set({
    freeShippingThreshold: logistics.freeThreshold,
    standardShippingFee: logistics.standardFee,
    currency: 'PKR',
  });
  console.log('  settings: logistics');
}

async function grantAdmin(uid: string) {
  await db.collection('roles').doc(uid).set({ role: 'ADMIN', grantedAt: new Date().toISOString() });
  console.log(`  roles: ADMIN granted to ${uid}`);
}

async function main() {
  const adminFlagIndex = process.argv.indexOf('--admin');

  // Granting a role is its own operation. It deliberately does NOT re-upload
  // the catalog — once products are edited in the console, a reseed would
  // silently overwrite those edits.
  if (adminFlagIndex !== -1) {
    const uid = process.argv[adminFlagIndex + 1]?.trim();
    if (!uid || uid.startsWith('-')) {
      console.error(
        [
          'Missing UID after --admin.',
          '',
          '  npm run seed -- --admin YOUR_USER_UID',
          '',
          'Keep it on ONE line. Copy the UID from Firebase Console -> Authentication -> Users.',
        ].join('\n'),
      );
      process.exit(1);
    }

    console.log(`Granting ADMIN in project "${projectId}"${usingEmulator ? ' (emulator)' : ''}…`);
    await grantAdmin(uid);
    console.log('Done. Sign out and back in on the site for the role to take effect.');
    return;
  }

  console.log(`Seeding project "${projectId}"${usingEmulator ? ' (emulator)' : ''}…`);

  await seedCategories();
  await seedProducts();
  await seedCoupons();
  await seedSettings();

  console.log('Done.');
  console.log('');
  console.log('To grant an admin: npm run seed -- --admin <uid>');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
