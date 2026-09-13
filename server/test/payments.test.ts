/**
 * Payment server against the Firebase emulators and the mock gateways.
 *
 *   (repo root) npm run emulators
 *   (server)    npm test
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { MOCK_JAZZCASH_SALT, startMockGateways, type MockGateways } from './mock-gateways.js';

// The auth emulator signs users into its own project, so share it; ids below
// are unique per run instead of wiping the emulator.
const PROJECT = 'demo-terntech';
const RUN = Date.now().toString(36);
const PRODUCT = `pay-test-${RUN}`;
const ORIGIN = 'https://terntechshop.com';

let mock: MockGateways;
let api: Server;
let apiUrl = '';
let payments: typeof import('../src/payments.js');
let db: typeof import('../src/firebase.js')['db'];
let adminAuth: typeof import('../src/firebase.js')['auth'];
let FieldValue: typeof import('firebase-admin/firestore')['FieldValue'];
let Timestamp: typeof import('firebase-admin/firestore')['Timestamp'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  mock = await startMockGateways(0, { hangMs: 2500, approveMs: 150 });

  Object.assign(process.env, {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIREBASE_PROJECT_ID: PROJECT,
    ALLOWED_ORIGINS: ORIGIN,
    GATEWAY_TIMEOUT_SECONDS: '1',
    RATE_LIMIT_PER_USER: '200',
    RATE_LIMIT_PER_IP: '500',
    JAZZCASH_MERCHANT_ID: 'MC12345',
    JAZZCASH_PASSWORD: 'secret-pass',
    JAZZCASH_INTEGRITY_SALT: MOCK_JAZZCASH_SALT,
    JAZZCASH_BASE_URL: mock.url,
    EASYPAISA_STORE_ID: '12345',
    EASYPAISA_USERNAME: 'ep-user',
    EASYPAISA_PASSWORD: 'ep-pass',
    EASYPAISA_ACCOUNT_NUMBER: '03000000000',
    EASYPAISA_BASE_URL: mock.url,
  });

  payments = await import('../src/payments.js');
  ({ db, auth: adminAuth } = await import('../src/firebase.js'));
  ({ FieldValue, Timestamp } = await import('firebase-admin/firestore'));
  const { createApp } = await import('../src/app.js');

  api = createApp().listen(0);
  await new Promise((resolve) => api.once('listening', resolve));
  const address = api.address();
  apiUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  await db.doc(`products/${PRODUCT}`).set({ name: 'Switch', price: 680000, stock: 10 });
});

after(async () => {
  api?.close();
  await mock?.close();
  // The Admin SDK keeps connections open; don't let them hold the test runner.
  setTimeout(() => process.exit(0), 200).unref();
});

let orderCounter = 0;

async function makeOrder(uid: string, overrides: Record<string, unknown> = {}) {
  orderCounter += 1;
  const ref = db.collection('orders').doc(`paytest${RUN}${String(orderCounter).padStart(4, '0')}`);
  await ref.set({
    userId: uid,
    manifestId: `TT-${RUN}${orderCounter}`,
    status: 'PENDING',
    paymentMethod: 'JAZZCASH',
    paymentStatus: 'UNPAID',
    items: [{ productId: PRODUCT, quantity: 2 }],
    total: 1360000,
    email: 'buyer@example.com',
    stockDeducted: true,
    createdAt: FieldValue.serverTimestamp(),
    ...overrides,
  });
  return ref.id;
}

async function waitForOrder(orderId: string, predicate: (data: Record<string, unknown>) => boolean, ms = 6000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const data = (await db.doc(`orders/${orderId}`).get()).data() ?? {};
    if (predicate(data)) return data;
    if (Date.now() > deadline) return data;
    await sleep(150);
  }
}

async function tokenFor(email: string): Promise<{ uid: string; token: string }> {
  const user = await adminAuth.createUser({ email, password: 'Password123' });
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123', returnSecureToken: true }) },
  );
  const { idToken } = (await response.json()) as { idToken: string };
  return { uid: user.uid, token: idToken };
}

const start = (token: string, body: Record<string, unknown>) =>
  fetch(`${apiUrl}/api/payments/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body),
  });

describe('HTTP surface', () => {
  it('reports the configured wallets without exposing secrets', async () => {
    const response = await fetch(`${apiUrl}/api/payments/config`);
    const text = await response.text();
    assert.deepEqual(JSON.parse(text).providers, ['JAZZCASH', 'EASYPAISA']);
    assert.ok(!text.includes('secret-pass') && !text.includes(MOCK_JAZZCASH_SALT));
  });

  it('allows the storefront origin and no other', async () => {
    const good = await fetch(`${apiUrl}/api/payments/config`, { headers: { Origin: ORIGIN } });
    assert.equal(good.headers.get('access-control-allow-origin'), ORIGIN);
    const bad = await fetch(`${apiUrl}/api/payments/config`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });

  it('refuses to start a payment without a signed-in user', async () => {
    const response = await fetch(`${apiUrl}/api/payments/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401);
  });

  it('refuses a forged token', async () => {
    const response = await start('not-a-real-token', { orderId: 'x' });
    assert.equal(response.status, 401);
  });
});

describe('starting a payment', () => {
  let customer: { uid: string; token: string };
  let other: { uid: string; token: string };

  before(async () => {
    customer = await tokenFor(`buyer-${RUN}@example.com`);
    other = await tokenFor(`other-${RUN}@example.com`);
  });

  it('JazzCash approval marks the order PAID, with the wallet masked and no CNIC stored', async () => {
    const orderId = await makeOrder(customer.uid);
    const response = await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '0300-1234561', cnicLast6: '654321' });
    assert.equal(response.status, 202);
    const { txnRef } = (await response.json()) as { txnRef: string };
    assert.match(txnRef, /^T\d{14}[0-9A-F]{5}$/);

    const processing = (await db.doc(`orders/${orderId}`).get()).data() ?? {};
    assert.equal(processing.paymentStatus, 'PROCESSING');

    const order = await waitForOrder(orderId, (data) => data.paymentStatus === 'PAID');
    assert.equal(order.paymentStatus, 'PAID');
    assert.equal(order.paymentWallet, '0300****561');
    assert.ok(order.paymentRef);
    const payment = (await db.doc(`payments/${txnRef}`).get()).data() ?? {};
    assert.equal(payment.status, 'PAID');
    assert.equal(payment.amount, 1360000);
    assert.ok(!JSON.stringify({ order, payment }).includes('654321'), 'CNIC must never be stored');
  });

  it('the amount charged comes from the order, not the request', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321', amount: 1 });
    await waitForOrder(orderId, (data) => data.paymentStatus === 'PAID');
    const sent = mock.log.findLast((entry) => entry.body.pp_BillReference === `TT${RUN}${orderCounter}`);
    assert.equal(sent?.body.pp_Amount, '1360000');
  });

  it('Easypaisa approval marks the order PAID', async () => {
    const orderId = await makeOrder(customer.uid, { paymentMethod: 'EASYPAISA' });
    const response = await start(customer.token, { orderId, provider: 'EASYPAISA', mobileNumber: '+92 345 1234561' });
    assert.equal(response.status, 202);
    const order = await waitForOrder(orderId, (data) => data.paymentStatus === 'PAID');
    assert.equal(order.paymentStatus, 'PAID');
  });

  it('a decline marks FAILED, and the customer can try again and pay', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234562', cnicLast6: '654321' });
    const failed = await waitForOrder(orderId, (data) => data.paymentStatus === 'FAILED');
    assert.equal(failed.paymentStatus, 'FAILED');
    assert.equal(failed.paymentMessage, 'JazzCash declined the payment.');

    const retry = await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    assert.equal(retry.status, 202);
    const paid = await waitForOrder(orderId, (data) => data.paymentStatus === 'PAID');
    assert.equal(paid.paymentStatus, 'PAID');
    assert.equal(paid.paymentAttempts, 2);
  });

  it('refuses a second payment while one is in progress', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    const again = await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    assert.equal(again.status, 409);
    await waitForOrder(orderId, (data) => data.paymentStatus === 'PAID');
  });

  it('refuses to pay an order that is already paid', async () => {
    const orderId = await makeOrder(customer.uid, { paymentStatus: 'PAID' });
    const response = await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    assert.equal(response.status, 409);
  });

  it('refuses someone else\'s order without revealing it exists', async () => {
    const orderId = await makeOrder(customer.uid);
    const response = await start(other.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    assert.equal(response.status, 404);
  });

  it('refuses a COD order, or a different wallet than the order was placed with', async () => {
    const cod = await makeOrder(customer.uid, { paymentMethod: 'COD', paymentStatus: null });
    assert.equal((await start(customer.token, { orderId: cod, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' })).status, 409);
    const jazz = await makeOrder(customer.uid);
    assert.equal((await start(customer.token, { orderId: jazz, provider: 'EASYPAISA', mobileNumber: '03001234561' })).status, 409);
  });

  it('validates the mobile number and JazzCash CNIC digits', async () => {
    const orderId = await makeOrder(customer.uid);
    assert.equal((await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '12345', cnicLast6: '654321' })).status, 400);
    assert.equal((await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '12' })).status, 400);
    assert.equal((await start(customer.token, { orderId, provider: 'PAYPAL', mobileNumber: '03001234561' })).status, 400);
  });

  it('refuses a cancelled order, and one whose payment window has passed', async () => {
    const cancelled = await makeOrder(customer.uid, { status: 'CANCELLED' });
    assert.equal((await start(customer.token, { orderId: cancelled, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' })).status, 409);
    const old = await makeOrder(customer.uid, { createdAt: Timestamp.fromMillis(Date.now() - 31 * 60_000), stockDeducted: false });
    assert.equal((await start(customer.token, { orderId: old, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' })).status, 409);
  });

  it('refuses a suspended customer', async () => {
    const suspect = await tokenFor(`suspect-${RUN}@example.com`);
    await db.doc(`suspensions/${suspect.uid}`).set({ reason: 'test' });
    const orderId = await makeOrder(suspect.uid);
    assert.equal((await start(suspect.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' })).status, 403);
  });
});

describe('unconfirmed payments and expiry', () => {
  let customer: { uid: string; token: string };

  before(async () => {
    customer = await tokenFor(`patient-${RUN}@example.com`);
  });

  it('"pending" stays PROCESSING until an inquiry confirms PAID', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234563', cnicLast6: '654321' });
    await sleep(800);
    assert.equal((await db.doc(`orders/${orderId}`).get()).data()?.paymentStatus, 'PROCESSING');

    await payments.reconcilePending();
    assert.equal((await db.doc(`orders/${orderId}`).get()).data()?.paymentStatus, 'PROCESSING');
    await payments.reconcilePending();
    assert.equal((await db.doc(`orders/${orderId}`).get()).data()?.paymentStatus, 'PAID');
  });

  it('a gateway that never answers is resolved by inquiry, not guessed', async () => {
    const orderId = await makeOrder(customer.uid, { paymentMethod: 'EASYPAISA' });
    await start(customer.token, { orderId, provider: 'EASYPAISA', mobileNumber: '03451234564' });
    await sleep(1500); // past the 1s gateway timeout
    assert.equal((await db.doc(`orders/${orderId}`).get()).data()?.paymentStatus, 'PROCESSING');
    await payments.reconcilePending();
    const order = await waitForOrder(orderId, (data) => data.paymentStatus === 'FAILED');
    assert.equal(order.paymentStatus, 'FAILED');
  });

  it('a wrong amount is flagged for REVIEW and can\'t be paid again', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234565', cnicLast6: '654321' });
    const order = await waitForOrder(orderId, (data) => data.paymentStatus === 'REVIEW');
    assert.equal(order.paymentStatus, 'REVIEW');
    assert.equal((await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' })).status, 409);
  });

  it('unpaid orders past the window are cancelled and their stock returned', async () => {
    const before = (await db.doc(`products/${PRODUCT}`).get()).data()?.stock as number;
    const unpaid = await makeOrder(customer.uid, { createdAt: Timestamp.fromMillis(Date.now() - 31 * 60_000) });
    const fresh = await makeOrder(customer.uid);
    const paid = await makeOrder(customer.uid, { paymentStatus: 'PAID', createdAt: Timestamp.fromMillis(Date.now() - 60 * 60_000) });

    await payments.expireUnpaidOrders();

    const expired = (await db.doc(`orders/${unpaid}`).get()).data() ?? {};
    assert.equal(expired.status, 'CANCELLED');
    assert.equal(expired.paymentStatus, 'EXPIRED');
    assert.equal(expired.stockDeducted, false);
    assert.equal((await db.doc(`products/${PRODUCT}`).get()).data()?.stock, before + 2);
    assert.equal((await db.doc(`orders/${fresh}`).get()).data()?.status, 'PENDING');
    assert.equal((await db.doc(`orders/${paid}`).get()).data()?.status, 'PENDING');

    // Running again changes nothing.
    await payments.expireUnpaidOrders();
    assert.equal((await db.doc(`products/${PRODUCT}`).get()).data()?.stock, before + 2);
  });

  it('money arriving for an order cancelled meanwhile is flagged, never kept silently', async () => {
    const orderId = await makeOrder(customer.uid);
    await start(customer.token, { orderId, provider: 'JAZZCASH', mobileNumber: '03001234561', cnicLast6: '654321' });
    await db.doc(`orders/${orderId}`).update({ status: 'CANCELLED' });
    const order = await waitForOrder(orderId, (data) => data.paymentStatus !== 'PROCESSING');
    assert.equal(order.paymentStatus, 'REVIEW');
  });
});
