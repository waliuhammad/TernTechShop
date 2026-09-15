/**
 * Firestore Security Rules tests.
 *
 * These run against the emulator and are the only proof that the storefront's
 * authorization actually holds. On a static site the browser is fully under
 * the visitor's control, so "the client wouldn't send that" is never an
 * argument — every case below is something a hand-crafted request could try.
 *
 *   npm run emulators      # in one terminal
 *   npm run test:rules     # in another
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

let testEnv;

const PRODUCT_ID = 'p-gpu-01';
const PRODUCT_PRICE = 45200000; // Rs. 452,000 in paisa
const PRODUCT_STOCK = 60;

const CUSTOMER = 'customer-uid';
const OTHER = 'other-uid';
const ADMIN = 'admin-uid';
const STAFF = 'staff-uid';
const NEWBIE = 'newbie-uid';
const SUSPECT = 'suspect-uid';

/** A product document that satisfies validProduct(). */
function validProduct(overrides = {}) {
  return {
    name: 'NVIDIA GeForce RTX 4080 SUPER 16GB',
    slug: 'nvidia-geforce-rtx-4080-super-16gb',
    sku: 'TT-GPU-4080S',
    category: 'Graphics Cards',
    tier: 'Extreme',
    price: PRODUCT_PRICE,
    stock: PRODUCT_STOCK,
    isActive: true,
    images: ['https://example.com/gpu.jpg'],
    ...overrides,
  };
}

/** A well-formed order: one unit, above the free-shipping threshold. */
function baseOrder(overrides = {}) {
  const items = overrides.items ?? [
    {
      productId: PRODUCT_ID,
      name: 'NVIDIA GeForce RTX 4080 SUPER 16GB',
      sku: 'TT-GPU-4080S',
      unitPrice: PRODUCT_PRICE,
      quantity: 1,
      lineTotal: PRODUCT_PRICE,
    },
  ];
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const discount = 0;
  const shipping = subtotal - discount >= 500000 ? 0 : 25000;

  return {
    userId: CUSTOMER,
    manifestId: 'TT-ABC123',
    status: 'PENDING',
    paymentMethod: 'COD',
    items,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    couponCode: '',
    fullName: 'Hira Nasir',
    phone: '03164587553',
    address: 'Office 22, Blue Area, Jinnah Avenue',
    city: 'Islamabad',
    ...overrides,
  };
}

/**
 * Places an order the way the storefront does: one batched write creating the
 * order and taking each line's quantity out of its product's stock.
 *
 * `reservations` and `deductions` override what the batch claims and takes,
 * so tests can forge either side. `stock: false` writes the order alone.
 */
function placeOrder(db, orderId, order, { stock = true, reservations, deductions = {}, extra = [] } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'orders', orderId), {
    stockDeducted: true,
    reservations: reservations ?? Object.fromEntries(order.items.map((item) => [item.productId, item.quantity])),
    createdAt: serverTimestamp(),
    ...order,
  });
  if (stock) {
    for (const item of order.items) {
      batch.update(doc(db, 'products', item.productId), {
        stock: increment(-(deductions[item.productId] ?? item.quantity)),
        lastOrderId: orderId,
      });
    }
  }
  for (const [productId, data] of extra) batch.update(doc(db, 'products', productId), data);
  return batch.commit();
}

async function stockOf(productId) {
  let stock;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    stock = (await getDoc(doc(ctx.firestore(), 'products', productId))).data().stock;
  });
  return stock;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-terntech',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  // The emulator keeps data between runs, so a second run would turn every
  // `setDoc` into an update and change what is being tested. Start clean.
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'products', PRODUCT_ID), validProduct());
    await setDoc(
      doc(db, 'products', 'p-cheap'),
      validProduct({
        name: 'NETGEAR GS308 8-Port Gigabit Switch',
        slug: 'netgear-gs308',
        sku: 'TT-NET-GS308',
        category: 'Networking',
        tier: 'Essential',
        price: 680000, // Rs. 6,800
        stock: 41,
      }),
    );
    await setDoc(doc(db, 'coupons', 'DEPLOY10'), {
      type: 'percentage',
      value: 10,
      minOrderAmount: 2000000,
      maxDiscountAmount: 1500000,
      isActive: true,
    });
    await setDoc(doc(db, 'roles', ADMIN), { role: 'ADMIN' });
    await setDoc(doc(db, 'roles', STAFF), { role: 'STAFF' });

    // Orders are validated against this document, so it must exist.
    await setDoc(doc(db, 'settings', 'logistics'), {
      standardShippingFee: 25000,
      freeShippingThreshold: 500000,
      currency: 'PKR',
    });
    await setDoc(doc(db, 'categories', 'storage'), {
      name: 'Storage', slug: 'storage', iconKey: 'hard-drive', colorHex: '#10b981',
      tagline: 'Data Storage Modules', description: 'Drives.', sortOrder: 3, isActive: true,
    });

    // Profiles for the accounts the admin panel will act on.
    for (const uid of [CUSTOMER, OTHER, NEWBIE, SUSPECT]) {
      await setDoc(doc(db, 'users', uid), { name: uid, email: `${uid}@example.com` });
    }

    // Eight distinct products for the lookup-budget test.
    for (let i = 1; i <= 8; i += 1) {
      await setDoc(
        doc(db, 'products', `budget-${i}`),
        validProduct({ name: `Budget ${i}`, slug: `budget-${i}`, sku: `B-${i}`, price: 1000000, stock: 10 }),
      );
    }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

const asCustomer = () => testEnv.authenticatedContext(CUSTOMER).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER).firestore();
const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore();
const asStaff = () => testEnv.authenticatedContext(STAFF).firestore();
const asSuspect = () => testEnv.authenticatedContext(SUSPECT).firestore();
const asGuest = () => testEnv.unauthenticatedContext().firestore();
const GUEST = 'guest-session-uid';
/** A guest checkout session: Firebase anonymous sign-in. */
const asGuestSession = (uid = GUEST) =>
  testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

describe('catalog', () => {
  it('is readable by anyone, signed in or not', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'products', PRODUCT_ID)));
  });

  it('cannot be written by a guest', async () => {
    await assertFails(setDoc(doc(asGuest(), 'products', 'injected'), validProduct()));
  });

  it('cannot be written by a signed-in customer', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'products', 'injected'), validProduct()));
  });

  it('cannot have its price rewritten by a customer', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'products', PRODUCT_ID), { price: 1 }));
  });

  it('can be created by an admin', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'products', 'admin-made'), validProduct({ slug: 'admin-made' })),
    );
  });

  it('can be edited by staff', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'products', 'admin-made'), { stock: 3 }));
  });
});

describe('catalog — admin panel input validation', () => {
  it('REJECTS a price saved as text', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'products', 'bad-1'), validProduct({ price: '45200000' })),
    );
  });

  it('REJECTS a fractional price', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'products', 'bad-2'), validProduct({ price: 452.5 })));
  });

  it('REJECTS a zero or negative price', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'products', 'bad-3'), validProduct({ price: 0 })));
  });

  it('REJECTS negative stock', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'products', 'bad-4'), validProduct({ stock: -1 })));
  });

  it('REJECTS an unknown tier', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'products', 'bad-5'), validProduct({ tier: 'Ultra' })),
    );
  });

  it('REJECTS a "was" price that is not above the selling price', async () => {
    await assertFails(
      setDoc(
        doc(asAdmin(), 'products', 'bad-6'),
        validProduct({ compareAtPrice: PRODUCT_PRICE - 1 }),
      ),
    );
  });

  it('accepts a valid "was" price', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAdmin(), 'products', 'sale-ok'),
        validProduct({ slug: 'sale-ok', compareAtPrice: PRODUCT_PRICE + 100000 }),
      ),
    );
  });

  it('allows an admin to delete a product', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'products', 'sale-ok')));
  });

  it('does NOT allow staff to delete a product', async () => {
    await assertFails(deleteDoc(doc(asStaff(), 'products', 'admin-made')));
  });
});

describe('roles', () => {
  it('cannot be self-assigned — no privilege escalation', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'roles', CUSTOMER), { role: 'ADMIN' }));
  });

  it('an admin cannot mint another ADMIN from the client', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'roles', OTHER), { role: 'ADMIN', grantedBy: ADMIN, grantedAt: serverTimestamp() }),
    );
  });

  it('is readable by its owner', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'roles', ADMIN)));
  });

  it('can be listed by staff', async () => {
    await assertSucceeds(getDocs(collection(asStaff(), 'roles')));
  });

  it('cannot be listed by a customer', async () => {
    await assertFails(getDocs(collection(asCustomer(), 'roles')));
  });
});

describe('coupons', () => {
  it('can be fetched by exact code, so the cart can validate it', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'coupons', 'DEPLOY10')));
  });

  it('can NOT be listed by customers — codes cannot be enumerated', async () => {
    await assertFails(getDocs(collection(asCustomer(), 'coupons')));
  });

  it('can NOT be listed by guests', async () => {
    await assertFails(getDocs(collection(asGuest(), 'coupons')));
  });

  it('can be listed by staff', async () => {
    await assertSucceeds(getDocs(collection(asStaff(), 'coupons')));
  });

  it('can be created by an admin', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'coupons', 'EID15'), {
        type: 'percentage',
        value: 15,
        minOrderAmount: 0,
        isActive: true,
      }),
    );
  });

  it('can NOT be created by staff', async () => {
    await assertFails(
      setDoc(doc(asStaff(), 'coupons', 'STAFF50'), {
        type: 'percentage',
        value: 50,
        minOrderAmount: 0,
        isActive: true,
      }),
    );
  });

  it('can NOT be created by a customer', async () => {
    await assertFails(
      setDoc(doc(asCustomer(), 'coupons', 'FREE'), {
        type: 'fixed',
        value: 99999999,
        minOrderAmount: 0,
        isActive: true,
      }),
    );
  });

  it('can be created by an admin with no cap (null)', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'coupons', 'NULLCAP'), {
        type: 'fixed',
        value: 50000,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        description: '',
        isActive: true,
      }),
    );
  });

  it('REJECTS a percentage over 100', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'coupons', 'OVER'), {
        type: 'percentage',
        value: 150,
        minOrderAmount: 0,
        isActive: true,
      }),
    );
  });
});

describe('cart', () => {
  it('accepts a valid line from its owner', async () => {
    await assertSucceeds(
      setDoc(doc(asCustomer(), 'carts', CUSTOMER, 'items', PRODUCT_ID), { quantity: 2 }),
    );
  });

  it('rejects a quantity beyond available stock', async () => {
    await assertFails(
      setDoc(doc(asCustomer(), 'carts', CUSTOMER, 'items', PRODUCT_ID), {
        quantity: PRODUCT_STOCK + 1,
      }),
    );
  });

  it('rejects a zero or negative quantity', async () => {
    await assertFails(
      setDoc(doc(asCustomer(), 'carts', CUSTOMER, 'items', PRODUCT_ID), { quantity: 0 }),
    );
  });

  it('rejects unexpected fields', async () => {
    await assertFails(
      setDoc(doc(asCustomer(), 'carts', CUSTOMER, 'items', PRODUCT_ID), {
        quantity: 1,
        unitPrice: 1,
      }),
    );
  });

  it('is not readable by another user', async () => {
    await assertFails(getDoc(doc(asOther(), 'carts', CUSTOMER, 'items', PRODUCT_ID)));
  });

  it('is not writable by another user', async () => {
    await assertFails(
      setDoc(doc(asOther(), 'carts', CUSTOMER, 'items', PRODUCT_ID), { quantity: 1 }),
    );
  });
});

describe('orders — integrity', () => {
  it('accepts a correctly priced order', async () => {
    await assertSucceeds(placeOrder(asCustomer(), 'ok-1', baseOrder()));
  });

  it('REJECTS a tampered unit price', async () => {
    const order = baseOrder({
      items: [
        {
          productId: PRODUCT_ID,
          name: 'NVIDIA GeForce RTX 4080 SUPER 16GB',
          sku: 'TT-GPU-4080S',
          unitPrice: 100, // Rs. 1 for a Rs. 452,000 card
          quantity: 1,
          lineTotal: 100,
        },
      ],
    });
    await assertFails(placeOrder(asCustomer(), 'tampered-price', order));
  });

  it('REJECTS a tampered total', async () => {
    const order = baseOrder();
    order.total = 100;
    await assertFails(placeOrder(asCustomer(), 'tampered-total', order));
  });

  it('REJECTS a tampered line total', async () => {
    const order = baseOrder();
    order.items[0].quantity = 3;
    order.items[0].lineTotal = PRODUCT_PRICE; // paying for one, taking three
    order.subtotal = PRODUCT_PRICE;
    order.total = PRODUCT_PRICE;
    await assertFails(placeOrder(asCustomer(), 'tampered-line', order));
  });

  it('REJECTS a subtotal that does not match the lines', async () => {
    const order = baseOrder();
    order.subtotal = 1000;
    order.total = 1000;
    await assertFails(placeOrder(asCustomer(), 'bad-subtotal', order));
  });

  it('REJECTS a product that does not exist', async () => {
    const order = baseOrder({
      items: [
        {
          productId: 'does-not-exist',
          name: 'Ghost',
          sku: 'X',
          unitPrice: 100,
          quantity: 1,
          lineTotal: 100,
        },
      ],
    });
    await assertFails(placeOrder(asCustomer(), 'ghost-product', order, { stock: false }));
  });

  it('REJECTS an invented discount with no coupon', async () => {
    const order = baseOrder();
    order.discount = 40000000;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertFails(placeOrder(asCustomer(), 'fake-discount', order));
  });

  it('REJECTS an unknown coupon code', async () => {
    const order = baseOrder();
    order.couponCode = 'NOTREAL';
    order.discount = 1000000;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertFails(placeOrder(asCustomer(), 'unknown-coupon', order));
  });

  it('REJECTS a discount larger than the coupon allows', async () => {
    const order = baseOrder();
    order.couponCode = 'DEPLOY10';
    order.discount = 30000000; // far beyond the Rs. 15,000 cap
    order.total = order.subtotal - order.discount + order.shipping;
    await assertFails(placeOrder(asCustomer(), 'over-discount', order));
  });

  it('accepts a correctly computed capped coupon discount', async () => {
    const order = baseOrder();
    order.couponCode = 'DEPLOY10';
    // 10% of 452,000 = 45,200 -> capped at the coupon's 15,000 ceiling.
    order.discount = 1500000;
    order.shipping = 0;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertSucceeds(placeOrder(asCustomer(), 'good-coupon', order));
  });

  it('accepts a coupon created from the admin panel', async () => {
    const order = baseOrder();
    order.couponCode = 'EID15';
    // 15% of 452,000 = 67,800, no cap on this coupon.
    order.discount = Math.floor((PRODUCT_PRICE * 15) / 100);
    order.shipping = 0;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertSucceeds(placeOrder(asCustomer(), 'admin-coupon', order));
  });

  it('accepts a coupon whose cap is stored as null (as the admin panel saves it)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'coupons', 'NOCAP20'), {
        type: 'percentage',
        value: 20,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        isActive: true,
      });
    });
    const order = baseOrder();
    order.couponCode = 'NOCAP20';
    order.discount = Math.floor((PRODUCT_PRICE * 20) / 100);
    order.shipping = 0;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertSucceeds(placeOrder(asCustomer(), 'null-cap-coupon', order));
  });

  it('REJECTS an inactive coupon', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'coupons', 'EXPIRED'), {
        type: 'fixed',
        value: 50000,
        minOrderAmount: 0,
        isActive: false,
      });
    });
    const order = baseOrder();
    order.couponCode = 'EXPIRED';
    order.discount = 50000;
    order.shipping = 0;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertFails(placeOrder(asCustomer(), 'inactive-coupon', order));
  });

  it('REJECTS a coupon below its minimum order value', async () => {
    const items = [
      {
        productId: 'p-cheap',
        name: 'NETGEAR GS308 8-Port Gigabit Switch',
        sku: 'TT-NET-GS308',
        unitPrice: 680000,
        quantity: 1,
        lineTotal: 680000,
      },
    ];
    const order = baseOrder({ items });
    order.subtotal = 680000;
    order.couponCode = 'DEPLOY10'; // minimum is Rs. 20,000
    order.discount = 68000;
    order.shipping = 0;
    order.total = order.subtotal - order.discount + order.shipping;
    await assertFails(placeOrder(asCustomer(), 'under-minimum', order));
  });

  it('accepts free shipping at or above the threshold', async () => {
    const items = [
      {
        productId: 'p-cheap',
        name: 'NETGEAR GS308 8-Port Gigabit Switch',
        sku: 'TT-NET-GS308',
        unitPrice: 680000,
        quantity: 1,
        lineTotal: 680000,
      },
    ];
    const order = baseOrder({ items });
    order.subtotal = 680000; // Rs. 6,800 >= Rs. 5,000
    order.shipping = 0;
    order.total = 680000;
    await assertSucceeds(placeOrder(asCustomer(), 'free-ship-ok', order));
  });

  it('REJECTS more lines than the rules can verify', async () => {
    const items = Array.from({ length: 9 }, () => ({
      productId: PRODUCT_ID,
      name: 'NVIDIA GeForce RTX 4080 SUPER 16GB',
      sku: 'TT-GPU-4080S',
      unitPrice: PRODUCT_PRICE,
      quantity: 1,
      lineTotal: PRODUCT_PRICE,
    }));
    const order = baseOrder({ items });
    order.subtotal = PRODUCT_PRICE * 9;
    order.shipping = 0;
    order.total = order.subtotal;
    await assertFails(placeOrder(asCustomer(), 'too-many-lines', order));
  });

  it('REJECTS an order placed on behalf of another user', async () => {
    await assertFails(placeOrder(asOther(), 'spoofed', baseOrder()));
  });

  it('REJECTS an order from a guest', async () => {
    await assertFails(placeOrder(asGuest(), 'guest-order', baseOrder()));
  });

  it('REJECTS a status other than PENDING on creation', async () => {
    const order = baseOrder({ status: 'DELIVERED' });
    await assertFails(placeOrder(asCustomer(), 'prestatus', order));
  });
});

describe('orders — stock reserved at checkout', () => {
  const oneCheap = (quantity = 1) => {
    const items = [
      { productId: 'p-cheap', name: 'NETGEAR GS308', sku: 'TT-NET-GS308', unitPrice: 680000, quantity, lineTotal: 680000 * quantity },
    ];
    const order = baseOrder({ items });
    order.subtotal = 680000 * quantity;
    order.shipping = 0;
    order.total = order.subtotal;
    return order;
  };

  it('placing an order takes exactly its quantity out of stock', async () => {
    const before = await stockOf('p-cheap');
    await assertSucceeds(placeOrder(asCustomer(), 'reserve-ok', oneCheap(3)));
    assert.equal(await stockOf('p-cheap'), before - 3);
  });

  it('REJECTS an order that claims a deduction but takes no stock', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-none', oneCheap(), { stock: false }));
  });

  it('REJECTS an old-style order without stock deducted', async () => {
    await assertFails(
      placeOrder(asCustomer(), 'reserve-old', { ...oneCheap(), stockDeducted: false, reservations: {} }, { stock: false }),
    );
  });

  it('REJECTS taking more stock than the order is for', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-more', oneCheap(1), { deductions: { 'p-cheap': 5 } }));
  });

  it('REJECTS taking less stock than the order is for', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-less', oneCheap(4), { deductions: { 'p-cheap': 1 } }));
  });

  it('REJECTS ordering more than is in stock (the last unit cannot sell twice)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'products', 'p-last'), validProduct({ name: 'Last One', slug: 'last-one', sku: 'L-1', price: 680000, stock: 1 }));
    });
    const lastOne = (id) => {
      const order = oneCheap();
      order.items = [{ ...order.items[0], productId: 'p-last', name: 'Last One', sku: 'L-1' }];
      return placeOrder(asCustomer(), id, order);
    };
    await assertSucceeds(lastOne('last-first'));
    await assertFails(lastOne('last-second'));
    assert.equal(await stockOf('p-last'), 0);
  });

  it('REJECTS a customer changing stock without placing an order', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'products', 'p-cheap'), { stock: increment(-1) }));
    await assertFails(updateDoc(doc(asCustomer(), 'products', 'p-cheap'), { stock: increment(-1), lastOrderId: 'made-up' }));
  });

  it('REJECTS replaying an earlier order to take stock again', async () => {
    await assertFails(
      updateDoc(doc(asCustomer(), 'products', 'p-cheap'), { stock: increment(-3), lastOrderId: 'reserve-ok' }),
    );
  });

  it('REJECTS a customer adding stock', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-add', oneCheap(1), { deductions: { 'p-cheap': -1 } }));
  });

  it('REJECTS draining a product that is not on the order', async () => {
    await assertFails(
      placeOrder(asCustomer(), 'reserve-extra', oneCheap(), {
        extra: [[PRODUCT_ID, { stock: increment(-1), lastOrderId: 'reserve-extra' }]],
      }),
    );
  });

  it('REJECTS a price change slipped into the checkout write', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-price', oneCheap(), { extra: [['p-cheap', { price: 100 }]] }));
  });

  it('REJECTS the same product on two lines', async () => {
    const order = oneCheap();
    order.items = [order.items[0], { ...order.items[0] }];
    order.subtotal = 1360000;
    order.total = 1360000;
    await assertFails(placeOrder(asCustomer(), 'reserve-dupe', order));
  });

  it('REJECTS taking stock for another customer\'s order', async () => {
    await assertFails(placeOrder(asOther(), 'reserve-spoof', oneCheap()));
  });

  it('REJECTS a fractional quantity', async () => {
    const order = oneCheap(1);
    order.items[0].quantity = 1.5;
    order.items[0].lineTotal = 1020000;
    order.subtotal = order.total = 1020000;
    await assertFails(placeOrder(asCustomer(), 'reserve-fraction', order, { reservations: { 'p-cheap': 1.5 } }));
  });

  it('REJECTS a missing or too-short consignee name', async () => {
    await assertFails(placeOrder(asCustomer(), 'reserve-noname', { ...oneCheap(), fullName: 'A' }));
    const nameless = oneCheap();
    delete nameless.fullName;
    await assertFails(placeOrder(asCustomer(), 'reserve-noname-2', nameless));
  });

  it('accepts a multi-line delivery address', async () => {
    await assertSucceeds(
      placeOrder(asCustomer(), 'reserve-multiline', { ...oneCheap(), address: 'Office 22, Blue Area\nJinnah Avenue' }),
    );
  });

  it('staff can still restock a product that was reserved', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'products', 'p-cheap'), { stock: increment(3) }));
  });

  it('staff can still edit a product that carries a reservation marker', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'products', 'p-cheap'), { name: 'NETGEAR GS308 v3' }));
  });
});

describe('orders — online payment', () => {
  const online = (paymentMethod, overrides = {}) => {
    const items = [
      { productId: 'p-cheap', name: 'NETGEAR GS308', sku: 'TT-NET-GS308', unitPrice: 680000, quantity: 1, lineTotal: 680000 },
    ];
    const order = baseOrder({ items, paymentMethod, paymentStatus: 'UNPAID', ...overrides });
    order.subtotal = 680000;
    order.shipping = 0;
    order.total = 680000;
    return order;
  };

  it('accepts an unpaid JazzCash order', async () => {
    await assertSucceeds(placeOrder(asCustomer(), 'pay-jazz', online('JAZZCASH')));
  });

  it('accepts an unpaid Easypaisa order', async () => {
    await assertSucceeds(placeOrder(asCustomer(), 'pay-easy', online('EASYPAISA')));
  });

  it('REJECTS an online order that claims to be paid already', async () => {
    await assertFails(placeOrder(asCustomer(), 'pay-forged', online('JAZZCASH', { paymentStatus: 'PAID' })));
  });

  it('REJECTS an online order with no payment status', async () => {
    const order = online('EASYPAISA');
    delete order.paymentStatus;
    await assertFails(placeOrder(asCustomer(), 'pay-nostatus', order));
  });

  it('REJECTS a COD order carrying a payment status', async () => {
    await assertFails(placeOrder(asCustomer(), 'pay-cod-status', online('COD', { paymentStatus: 'PAID' })));
  });

  it('REJECTS an unknown payment method', async () => {
    await assertFails(placeOrder(asCustomer(), 'pay-unknown', online('BITCOIN')));
  });

  it('a customer cannot mark their order paid', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'orders', 'pay-jazz'), { paymentStatus: 'PAID' }));
  });

  it('staff cannot mark an order paid either (only the payment server can)', async () => {
    await assertFails(updateDoc(doc(asStaff(), 'orders', 'pay-jazz'), { paymentStatus: 'PAID' }));
  });

  it('staff can still move an online order through its lifecycle', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'orders', 'pay-easy'), { status: 'CONFIRMED' }));
  });

  it('payment attempts are readable by staff only, and writable by nobody', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'payments', 'T123'), { orderId: 'pay-jazz', userId: CUSTOMER, status: 'PAID' });
    });
    await assertSucceeds(getDoc(doc(asStaff(), 'payments', 'T123')));
    await assertFails(getDoc(doc(asCustomer(), 'payments', 'T123')));
    await assertFails(setDoc(doc(asCustomer(), 'payments', 'T999'), { orderId: 'pay-jazz', status: 'PAID' }));
    await assertFails(setDoc(doc(asStaff(), 'payments', 'T999'), { orderId: 'pay-jazz', status: 'PAID' }));
  });
});

describe('orders — access and lifecycle', () => {
  it('is readable by the customer who placed it', async () => {
    await assertSucceeds(getDoc(doc(asCustomer(), 'orders', 'ok-1')));
  });

  it('is NOT readable by another customer', async () => {
    await assertFails(getDoc(doc(asOther(), 'orders', 'ok-1')));
  });

  it('is readable by staff', async () => {
    await assertSucceeds(getDoc(doc(asStaff(), 'orders', 'ok-1')));
  });

  it('can be listed in full by staff (admin order table)', async () => {
    await assertSucceeds(getDocs(collection(asStaff(), 'orders')));
  });

  it('can NOT be listed in full by a customer', async () => {
    await assertFails(getDocs(collection(asCustomer(), 'orders')));
  });

  it('cannot be edited by the customer after placement', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'orders', 'ok-1'), { total: 1 }));
  });

  it('cannot have its status changed by the customer', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'orders', 'ok-1'), { status: 'CANCELLED' }));
  });

  it('cannot be deleted by anyone', async () => {
    await assertFails(deleteDoc(doc(asCustomer(), 'orders', 'ok-1')));
    await assertFails(deleteDoc(doc(asAdmin(), 'orders', 'ok-1')));
  });

  it('allows staff to advance the status', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'orders', 'ok-1'), { status: 'CONFIRMED' }));
  });

  it('allows staff to record stock deduction and a note', async () => {
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'orders', 'ok-1'), {
        stockDeducted: true,
        adminNote: 'Confirmed by phone.',
      }),
    );
  });

  it('REJECTS a status outside the lifecycle', async () => {
    await assertFails(updateDoc(doc(asStaff(), 'orders', 'ok-1'), { status: 'REFUNDED_TO_ME' }));
  });

  it('does NOT allow staff to rewrite the money', async () => {
    await assertFails(updateDoc(doc(asStaff(), 'orders', 'ok-1'), { total: 1 }));
  });
});

describe('profile', () => {
  it('is writable by its owner', async () => {
    await assertSucceeds(
      setDoc(doc(asCustomer(), 'users', CUSTOMER), {
        name: 'Hira Nasir',
        email: 'hira@example.com',
        phone: '03164587553',
        city: 'Islamabad',
        address: 'Blue Area',
      }),
    );
  });

  it('is not readable by another user', async () => {
    await assertFails(getDoc(doc(asOther(), 'users', CUSTOMER)));
  });

  it('can be listed by staff (customer table)', async () => {
    await assertSucceeds(getDocs(collection(asStaff(), 'users')));
  });

  it('can NOT be listed by a customer', async () => {
    await assertFails(getDocs(collection(asCustomer(), 'users')));
  });

  it('rejects unexpected fields such as a role claim', async () => {
    await assertFails(
      setDoc(doc(asCustomer(), 'users', CUSTOMER), { name: 'Hira Nasir', role: 'ADMIN' }),
    );
  });
});

describe('staff grants from the admin panel', () => {
  const grant = (by = ADMIN, role = 'STAFF') => ({ role, grantedBy: by, grantedAt: serverTimestamp() });

  it('an admin can make an existing user STAFF', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'roles', NEWBIE), grant()));
  });

  it('staff cannot grant STAFF', async () => {
    await assertFails(setDoc(doc(asStaff(), 'roles', OTHER), grant(STAFF)));
  });

  it('a customer cannot make themselves STAFF', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'roles', CUSTOMER), grant(CUSTOMER)));
  });

  it('an admin cannot change their own role', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'roles', ADMIN), grant()));
  });

  it('an existing STAFF role cannot be edited up to ADMIN', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'roles', NEWBIE), grant(ADMIN, 'ADMIN')));
  });

  it('cannot grant a role to an account that does not exist', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'roles', 'ghost-uid'), grant()));
  });

  it('cannot forge who granted it', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'roles', OTHER), grant(STAFF)));
  });

  it('an admin can revoke STAFF', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'roles', NEWBIE)));
  });

  it('an admin cannot delete an ADMIN role from the client', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'roles', 'other-admin'), { role: 'ADMIN' });
    });
    await assertFails(deleteDoc(doc(asAdmin(), 'roles', 'other-admin')));
  });

  it('staff cannot revoke STAFF', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'roles', NEWBIE), { role: 'STAFF' });
    });
    await assertFails(deleteDoc(doc(asStaff(), 'roles', NEWBIE)));
  });
});

describe('suspensions', () => {
  const suspension = (by = ADMIN) => ({
    reason: 'Repeated fake orders',
    suspendedBy: by,
    suspendedAt: serverTimestamp(),
  });

  it('a customer cannot suspend anyone', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'suspensions', SUSPECT), suspension(CUSTOMER)));
  });

  it('staff cannot suspend', async () => {
    await assertFails(setDoc(doc(asStaff(), 'suspensions', SUSPECT), suspension(STAFF)));
  });

  it('an admin cannot suspend a staff member (revoke the role first)', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'suspensions', STAFF), suspension()));
  });

  it('an admin cannot suspend themselves', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'suspensions', ADMIN), suspension()));
  });

  it('control: the customer can order before being suspended', async () => {
    await assertSucceeds(placeOrder(asSuspect(), 'suspect-before', baseOrder({ userId: SUSPECT })));
  });

  it('an admin can suspend a customer', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'suspensions', SUSPECT), suspension()));
  });

  it('the suspended user can read their own suspension', async () => {
    await assertSucceeds(getDoc(doc(asSuspect(), 'suspensions', SUSPECT)));
  });

  it('another customer cannot read it', async () => {
    await assertFails(getDoc(doc(asCustomer(), 'suspensions', SUSPECT)));
  });

  it('a suspended user CANNOT add to their cart', async () => {
    await assertFails(setDoc(doc(asSuspect(), 'carts', SUSPECT, 'items', PRODUCT_ID), { quantity: 1 }));
  });

  it('a suspended user CANNOT place an order', async () => {
    await assertFails(placeOrder(asSuspect(), 'suspect-during', baseOrder({ userId: SUSPECT })));
  });

  it('a suspended user cannot lift their own suspension', async () => {
    await assertFails(deleteDoc(doc(asSuspect(), 'suspensions', SUSPECT)));
  });

  it('a suspended user can still see their past orders', async () => {
    await assertSucceeds(getDoc(doc(asSuspect(), 'orders', 'suspect-before')));
  });

  it('an admin can reinstate, and ordering works again', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'suspensions', SUSPECT)));
    await assertSucceeds(placeOrder(asSuspect(), 'suspect-after', baseOrder({ userId: SUSPECT })));
  });
});

describe('orders — lookup budget', () => {
  const lines = (n) =>
    Array.from({ length: n }, (_, i) => ({
      productId: `budget-${i + 1}`,
      name: `Budget ${i + 1}`,
      sku: `B-${i + 1}`,
      unitPrice: 1000000,
      quantity: 1,
      lineTotal: 1000000,
    }));

  it('a full 7-product order with a coupon and stock deduction fits the lookup limits', async () => {
    const order = baseOrder({ items: lines(7) });
    order.subtotal = 7000000; // Rs. 70,000
    order.couponCode = 'DEPLOY10';
    order.discount = 700000;
    order.shipping = 0;
    order.total = order.subtotal - order.discount;
    await assertSucceeds(placeOrder(asCustomer(), 'budget-full', order));
  });

  it('a full 7-product order still rejects one forged price on the last line', async () => {
    const items = lines(7);
    items[6].unitPrice = 100;
    items[6].lineTotal = 100;
    const order = baseOrder({ items });
    order.subtotal = 6000100;
    order.shipping = 0;
    order.total = 6000100;
    await assertFails(placeOrder(asCustomer(), 'budget-forged', order));
  });

  it('a full 7-product ONLINE order with a coupon also fits', async () => {
    const order = baseOrder({ items: lines(7), paymentMethod: 'EASYPAISA', paymentStatus: 'UNPAID' });
    order.subtotal = 7000000;
    order.couponCode = 'DEPLOY10';
    order.discount = 700000;
    order.shipping = 0;
    order.total = order.subtotal - order.discount;
    await assertSucceeds(placeOrder(asCustomer(), 'budget-full-online', order));
  });

  it('an 8-product order is refused', async () => {
    const order = baseOrder({ items: lines(8) });
    order.subtotal = 8000000;
    order.shipping = 0;
    order.total = 8000000;
    await assertFails(placeOrder(asCustomer(), 'budget-eight', order));
  });
});

describe('shipping settings from the admin panel', () => {
  const cheapOrder = (shipping) => {
    const items = [
      { productId: 'p-cheap', name: 'NETGEAR GS308', sku: 'TT-NET-GS308', unitPrice: 680000, quantity: 1, lineTotal: 680000 },
    ];
    const order = baseOrder({ items });
    order.subtotal = 680000;
    order.shipping = shipping;
    order.total = 680000 + shipping;
    return order;
  };

  it('are publicly readable (the cart needs them)', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'settings', 'logistics')));
  });

  it('cannot be changed by staff', async () => {
    await assertFails(updateDoc(doc(asStaff(), 'settings', 'logistics'), { standardShippingFee: 0 }));
  });

  it('cannot be changed by a customer', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'settings', 'logistics'), { standardShippingFee: 0 }));
  });

  it('REJECT a fee saved as text', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'settings', 'logistics'), { standardShippingFee: '300' }));
  });

  it('cannot be deleted, even by an admin', async () => {
    await assertFails(deleteDoc(doc(asAdmin(), 'settings', 'logistics')));
  });

  it('an admin change is enforced on the very next order', async () => {
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'settings', 'logistics'), {
        standardShippingFee: 30000,
        freeShippingThreshold: 1000000, // Rs. 10,000
      }),
    );
    // Rs. 6,800 is now below the threshold, so shipping applies at the NEW fee.
    await assertFails(placeOrder(asCustomer(), 'ship-old-fee', cheapOrder(25000)));
    await assertFails(placeOrder(asCustomer(), 'ship-free', cheapOrder(0)));
    await assertSucceeds(placeOrder(asCustomer(), 'ship-new-fee', cheapOrder(30000)));
    // Restore for any later suite.
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'settings', 'logistics'), {
        standardShippingFee: 25000,
        freeShippingThreshold: 500000,
      }),
    );
  });
});

describe('categories', () => {
  const category = (overrides = {}) => ({
    name: 'Memory', slug: 'memory', iconKey: 'memory-stick', colorHex: '#6366f1',
    tagline: 'RAM', description: 'Desktop and server memory.', sortOrder: 6, isActive: true,
    ...overrides,
  });

  it('staff can add a category', async () => {
    await assertSucceeds(setDoc(doc(asStaff(), 'categories', 'memory'), category()));
  });

  it('staff can rename it (name changes, slug does not)', async () => {
    await assertSucceeds(updateDoc(doc(asStaff(), 'categories', 'memory'), { name: 'Memory Modules' }));
  });

  it('a customer cannot add a category', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'categories', 'hacked'), category({ slug: 'hacked' })));
  });

  it('REJECTS a slug that does not match the document id', async () => {
    await assertFails(setDoc(doc(asStaff(), 'categories', 'cables'), category({ slug: 'memory' })));
  });

  it('REJECTS an invalid colour', async () => {
    await assertFails(setDoc(doc(asStaff(), 'categories', 'fans'), category({ slug: 'fans', colorHex: 'red' })));
  });

  it('staff cannot delete a category', async () => {
    await assertFails(deleteDoc(doc(asStaff(), 'categories', 'memory')));
  });

  it('an admin can delete a category', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'categories', 'memory')));
  });
});

describe('saved addresses', () => {
  const address = (overrides = {}) => ({
    label: 'Office', fullName: 'Hira Nasir', phone: '03164587553',
    address: 'Office 22, Blue Area, Jinnah Avenue', city: 'Islamabad', isDefault: true,
    ...overrides,
  });

  it('the owner can save an address', async () => {
    await assertSucceeds(setDoc(doc(asCustomer(), 'users', CUSTOMER, 'addresses', 'a1'), address()));
  });

  it('another customer cannot read it', async () => {
    await assertFails(getDoc(doc(asOther(), 'users', CUSTOMER, 'addresses', 'a1')));
  });

  it('another customer cannot write into it', async () => {
    await assertFails(setDoc(doc(asOther(), 'users', CUSTOMER, 'addresses', 'a2'), address()));
  });

  it('REJECTS unexpected fields', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'users', CUSTOMER, 'addresses', 'a3'), address({ role: 'ADMIN' })));
  });
});

describe('reviews', () => {
  const review = (productId = PRODUCT_ID, uid = CUSTOMER, overrides = {}) => ({
    productId, userId: uid, authorName: 'Hira N.', rating: 5, title: 'Solid card',
    body: 'Runs cool under sustained load. Delivered quickly.', status: 'PENDING',
    createdAt: serverTimestamp(), ...overrides,
  });
  const id = (productId = PRODUCT_ID, uid = CUSTOMER) => `${productId}_${uid}`;

  it('a guest cannot post a review', async () => {
    await assertFails(setDoc(doc(asGuest(), 'reviews', id(PRODUCT_ID, 'guest')), review(PRODUCT_ID, 'guest')));
  });

  it('checking for your own review before writing one does not error', async () => {
    await assertSucceeds(getDoc(doc(asCustomer(), 'reviews', id())));
  });

  it('a customer can post a pending review', async () => {
    await assertSucceeds(setDoc(doc(asCustomer(), 'reviews', id()), review()));
  });

  it('REJECTS a second review of the same product by the same customer', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'reviews', id()), review(PRODUCT_ID, CUSTOMER, { rating: 1 })));
  });

  it('REJECTS a review that approves itself', async () => {
    await assertFails(setDoc(doc(asOther(), 'reviews', id(PRODUCT_ID, OTHER)), review(PRODUCT_ID, OTHER, { status: 'APPROVED' })));
  });

  it('REJECTS a review filed under someone else', async () => {
    await assertFails(setDoc(doc(asOther(), 'reviews', id()), review()));
  });

  it('REJECTS a rating out of range', async () => {
    await assertFails(setDoc(doc(asOther(), 'reviews', id(PRODUCT_ID, OTHER)), review(PRODUCT_ID, OTHER, { rating: 6 })));
  });

  it('REJECTS a review of a product that does not exist', async () => {
    await assertFails(setDoc(doc(asOther(), 'reviews', id('ghost', OTHER)), review('ghost', OTHER)));
  });

  it('a pending review is hidden from other customers', async () => {
    await assertFails(getDoc(doc(asOther(), 'reviews', id())));
  });

  it('the author can see their own pending review', async () => {
    await assertSucceeds(getDoc(doc(asCustomer(), 'reviews', id())));
  });

  it('the author cannot approve their own review', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'reviews', id()), { status: 'APPROVED', moderatedBy: CUSTOMER }));
  });

  it('staff can approve it', async () => {
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'reviews', id()), { status: 'APPROVED', moderatedBy: STAFF, moderatedAt: serverTimestamp() }),
    );
  });

  it('staff cannot edit the review text while moderating', async () => {
    await assertFails(updateDoc(doc(asStaff(), 'reviews', id()), { body: 'Rewritten by staff to sound better.', moderatedBy: STAFF }));
  });

  it('guests can list approved reviews for a product', async () => {
    await assertSucceeds(
      getDocs(query(collection(asGuest(), 'reviews'), where('productId', '==', PRODUCT_ID), where('status', '==', 'APPROVED'))),
    );
  });

  it('guests cannot list reviews without the APPROVED filter', async () => {
    await assertFails(getDocs(query(collection(asGuest(), 'reviews'), where('productId', '==', PRODUCT_ID))));
  });

  it('a suspended customer cannot post a review', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'suspensions', SUSPECT), { reason: 'x', suspendedBy: ADMIN });
    });
    await assertFails(setDoc(doc(asSuspect(), 'reviews', id(PRODUCT_ID, SUSPECT)), review(PRODUCT_ID, SUSPECT)));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'suspensions', SUSPECT));
    });
  });
});

describe('contact messages', () => {
  const message = (overrides = {}) => ({
    name: 'Ali Raza', email: 'ali@example.com', subject: 'Bulk Deployment Query',
    message: 'We need 40 workstations for a new office.', status: 'NEW',
    createdAt: serverTimestamp(), ...overrides,
  });

  it('a guest can send a message', async () => {
    await assertSucceeds(setDoc(doc(asGuest(), 'contactMessages', 'm1'), message()));
  });

  it('a guest cannot read messages', async () => {
    await assertFails(getDoc(doc(asGuest(), 'contactMessages', 'm1')));
  });

  it('a customer cannot list the inbox', async () => {
    await assertFails(getDocs(collection(asCustomer(), 'contactMessages')));
  });

  it('REJECTS an unknown subject', async () => {
    await assertFails(setDoc(doc(asGuest(), 'contactMessages', 'm2'), message({ subject: 'Free stuff' })));
  });

  it('REJECTS a message pre-marked as handled', async () => {
    await assertFails(setDoc(doc(asGuest(), 'contactMessages', 'm3'), message({ status: 'HANDLED' })));
  });

  it('REJECTS a message claiming to be from another account', async () => {
    await assertFails(setDoc(doc(asGuest(), 'contactMessages', 'm4'), message({ userId: CUSTOMER })));
  });

  it('staff can read and mark it handled', async () => {
    await assertSucceeds(getDocs(collection(asStaff(), 'contactMessages')));
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'contactMessages', 'm1'), { status: 'HANDLED', handledBy: STAFF, handledAt: serverTimestamp() }),
    );
  });

  it('staff cannot delete messages, an admin can', async () => {
    await assertFails(deleteDoc(doc(asStaff(), 'contactMessages', 'm1')));
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'contactMessages', 'm1')));
  });
});

describe('warranty registrations', () => {
  const registration = (serial, overrides = {}) => ({
    serialNumber: serial, manifestId: 'TT-ABC123', email: 'hira@example.com',
    productName: 'RTX 4080 SUPER', status: 'PENDING', createdAt: serverTimestamp(), ...overrides,
  });

  it('a guest can register a serial number', async () => {
    await assertSucceeds(setDoc(doc(asGuest(), 'warranties', 'SN-100200'), registration('SN-100200')));
  });

  it('REJECTS registering the same serial twice', async () => {
    await assertFails(setDoc(doc(asGuest(), 'warranties', 'SN-100200'), registration('SN-100200', { email: 'other@example.com' })));
  });

  it('REJECTS a serial with invalid characters', async () => {
    await assertFails(setDoc(doc(asGuest(), 'warranties', 'sn 1'), registration('sn 1')));
  });

  it('REJECTS a registration pre-approved by the client', async () => {
    await assertFails(setDoc(doc(asGuest(), 'warranties', 'SN-300400'), registration('SN-300400', { status: 'APPROVED' })));
  });

  it('a signed-in customer can see their own registration', async () => {
    await assertSucceeds(setDoc(doc(asCustomer(), 'warranties', 'SN-500600'), registration('SN-500600', { userId: CUSTOMER })));
    await assertSucceeds(getDoc(doc(asCustomer(), 'warranties', 'SN-500600')));
  });

  it('nobody else can read a registration', async () => {
    await assertFails(getDoc(doc(asGuest(), 'warranties', 'SN-100200')));
    await assertFails(getDoc(doc(asOther(), 'warranties', 'SN-500600')));
    await assertFails(getDocs(collection(asCustomer(), 'warranties')));
  });

  it('a customer cannot approve a warranty', async () => {
    await assertFails(updateDoc(doc(asCustomer(), 'warranties', 'SN-500600'), { status: 'APPROVED', reviewedBy: CUSTOMER }));
  });

  it('staff can approve with a note', async () => {
    await assertSucceeds(
      updateDoc(doc(asStaff(), 'warranties', 'SN-100200'), {
        status: 'APPROVED', note: 'Matched to order.', reviewedBy: STAFF, reviewedAt: serverTimestamp(),
      }),
    );
  });
});

describe('guest checkout (no account)', () => {
  const guestOrder = (overrides = {}) =>
    baseOrder({ userId: GUEST, manifestId: 'TT-GUEST1', guestCheckout: true, email: 'shopper@example.com', ...overrides });

  it('a shopper with no session at all cannot place an order', async () => {
    await assertFails(placeOrder(asGuest(), 'guest-none', baseOrder({ userId: 'guest' })));
  });

  it('a guest session can place a COD order and take the stock', async () => {
    const before = await stockOf(PRODUCT_ID);
    await assertSucceeds(placeOrder(asGuestSession(), 'guest-1', guestOrder()));
    assert.equal(await stockOf(PRODUCT_ID), before - 1);
  });

  it('a guest session can place an unpaid wallet order', async () => {
    const items = [
      { productId: 'p-cheap', name: 'NETGEAR GS308', sku: 'TT-NET-GS308', unitPrice: 680000, quantity: 1, lineTotal: 680000 },
    ];
    await assertSucceeds(
      placeOrder(asGuestSession(), 'guest-wallet', guestOrder({
        items, subtotal: 680000, shipping: 0, total: 680000, paymentMethod: 'JAZZCASH', paymentStatus: 'UNPAID',
      })),
    );
  });

  it('a guest session can use a coupon like anyone else', async () => {
    const order = guestOrder({ couponCode: 'DEPLOY10', discount: 1500000 });
    order.total = order.subtotal - order.discount + order.shipping;
    await assertSucceeds(placeOrder(asGuestSession(), 'guest-coupon', order));
  });

  it('REJECTS a guest order that hides that it is a guest order', async () => {
    const order = guestOrder();
    delete order.guestCheckout;
    await assertFails(placeOrder(asGuestSession(), 'guest-hidden', order));
  });

  it('REJECTS an account order that pretends to be a guest order', async () => {
    await assertFails(placeOrder(asCustomer(), 'fake-guest', baseOrder({ guestCheckout: true })));
  });

  it("REJECTS a guest order placed under another shopper's uid", async () => {
    await assertFails(placeOrder(asGuestSession(), 'guest-spoof', guestOrder({ userId: CUSTOMER })));
  });

  it('the guest can read back their own order (confirmation page)', async () => {
    await assertSucceeds(getDoc(doc(asGuestSession(), 'orders', 'guest-1')));
    await assertSucceeds(
      getDocs(query(collection(asGuestSession(), 'orders'), where('userId', '==', GUEST), where('manifestId', '==', 'TT-GUEST1'))),
    );
  });

  it('another guest session cannot read it', async () => {
    await assertFails(getDoc(doc(asGuestSession('another-guest'), 'orders', 'guest-1')));
  });

  it('staff can read and process guest orders', async () => {
    await assertSucceeds(getDoc(doc(asStaff(), 'orders', 'guest-1')));
    await assertSucceeds(updateDoc(doc(asStaff(), 'orders', 'guest-1'), { status: 'CONFIRMED' }));
  });

  it('a guest session cannot alter its order', async () => {
    await assertFails(updateDoc(doc(asGuestSession(), 'orders', 'guest-1'), { total: 1 }));
  });

  it('a guest session cannot create a profile, address, server cart or wishlist', async () => {
    await assertFails(setDoc(doc(asGuestSession(), 'users', GUEST), { name: 'Guest Shopper', email: 'g@example.com' }));
    await assertFails(setDoc(doc(asGuestSession(), 'users', GUEST, 'addresses', 'a1'), {
      label: 'Home', fullName: 'Guest Shopper', phone: '03164587553', address: 'House 1, Street 2, F-7', city: 'Islamabad', isDefault: true,
    }));
    await assertFails(setDoc(doc(asGuestSession(), 'carts', GUEST, 'items', PRODUCT_ID), { quantity: 1 }));
    await assertFails(setDoc(doc(asGuestSession(), 'wishlists', GUEST, 'items', PRODUCT_ID), { addedAt: serverTimestamp() }));
  });

  it('a guest session cannot post a review', async () => {
    await assertFails(setDoc(doc(asGuestSession(), 'reviews', `p-cheap_${GUEST}`), {
      productId: 'p-cheap', userId: GUEST, authorName: 'Guest', rating: 5,
      body: 'Anonymous praise for this switch.', status: 'PENDING', createdAt: serverTimestamp(),
    }));
  });

  it('a guest session cannot reserve stock without an order', async () => {
    await assertFails(updateDoc(doc(asGuestSession(), 'products', PRODUCT_ID), { stock: 0 }));
  });

  it('an account keeps full access (sign-in provider password)', async () => {
    const member = testEnv.authenticatedContext('member-uid', { firebase: { sign_in_provider: 'password' } }).firestore();
    await assertSucceeds(setDoc(doc(member, 'users', 'member-uid'), { name: 'Member', email: 'm@example.com' }));
    await assertSucceeds(setDoc(doc(member, 'carts', 'member-uid', 'items', 'p-cheap'), { quantity: 1 }));
  });
});

describe('default deny', () => {
  it('blocks collections the rules do not mention', async () => {
    await assertFails(setDoc(doc(asCustomer(), 'anything', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(asAdmin(), 'anything', 'x')));
  });
});

it('sanity: test environment initialised', () => {
  assert.ok(testEnv);
});
