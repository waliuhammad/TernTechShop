# Tern Technologies — Storefront

A multi-page React storefront recreating the design and shopping experience of
`terntechshop.com`, backed by **Firebase Authentication** and **Cloud Firestore**.

It still builds to a static `dist/` folder for Hostinger — Firebase is a client SDK talking to
Google-hosted infrastructure, so there is no server to run.

**Stack:** Vite 8 · React 19 · TypeScript (strict) · Tailwind CSS v4 · React Router 7 ·
Firebase 12 (Auth + Firestore) · Framer Motion · Lucide.

---

## Quick start

```bash
npm install
cp .env.example .env    # then fill in your Firebase keys
npm run dev             # http://localhost:5173
```

| Guide | For |
|---|---|
| **[docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md)** | Connecting your Firebase project — do this first |
| **[docs/CLOUDINARY-SETUP.md](docs/CLOUDINARY-SETUP.md)** | Turning on product image uploads (free) |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Uploading `dist/` to Hostinger |
| **[docs/SPEC.md](docs/SPEC.md)** | Design reference, page-by-page layout |

Without a `.env` the site still runs on the bundled catalog, with sign-in disabled.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (live Firebase) |
| `npm run dev:emulator` | Dev server against the local emulator |
| `npm run build` | Type-check and build `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run emulators` | Local Firebase Auth + Firestore (needs Java 11+) |
| `npm run test:rules` | Security rules test suite (needs emulators running) |
| `npm run seed` | Upload catalog, coupons, settings to Firestore |
| `npm run seed -- --admin <uid>` | Grant a user the ADMIN role (doesn't touch the catalog) |

---

## What's built

| Area | Behaviour |
|---|---|
| **Accounts** | Register, sign in, sign out, password reset by email |
| **Roles** | CUSTOMER / STAFF / ADMIN, granted only via the Admin SDK |
| **Catalog** | Served from Firestore; falls back to bundled data if unreachable |
| **Cart** | Guests: in the browser. Signed in: in Firestore, live-synced across devices |
| **Cart merge** | A guest cart folds into the account on sign-in (quantities summed, clamped to stock) |
| **Wishlist** | Same guest/account model as the cart |
| **Checkout** | Three validated steps; requires sign-in |
| **Orders** | Written to Firestore, **prices and totals re-verified server-side** |
| **Order history** | Per-account, with status |
| **Search / filters / sort / pagination** | All mirrored to the URL |
| **Coupons** | Looked up by exact code, never listable; re-validated server-side on every order |
| **Admin panel** | `/admin` — dashboard, orders, products, customers, coupons (see below) |

---

## Security model

A static site cannot trust the browser, so **authorization lives entirely in
[`firestore.rules`](firestore.rules)**, which Google enforces on every read and write.

The critical rule is order integrity. When a customer places an order, the rules independently:

- look up each product and reject the order if any **unit price** differs from the catalog
- recompute every **line total**, the **subtotal**, **shipping** and the **grand total**
- look up the **coupon** and reject any discount it doesn't entitle
- confirm the order belongs to the **signed-in user** and starts as `PENDING`

A tampered client that submits a Rs. 452,000 graphics card at Rs. 1 is refused by the server.

The rules also prevent: reading another user's cart, wishlist, profile or orders; editing an
order after it's placed; rewriting an order's money (even as staff); enumerating coupon codes;
and granting yourself a role.

**All of this is tested.** `npm run test:rules` runs 99 cases against the emulator, including
each attack above.

---

## Known limits

| Limit | Detail |
|---|---|
| 8 products per order | Rules verify each line against the catalog, within Firestore's 10-lookup cap |
| Stock reserved at confirmation | Two shoppers can both order the last unit; only one can be confirmed |
| Image uploads via Cloudinary (unsigned) | The upload preset name is public; someone could upload images to your account, but not read or delete existing ones |
| Suspension is soft | A suspended customer can still sign in and see past orders; cart and checkout are refused |
| No online payments | Cash on Delivery only |
| Client-rendered SEO | Crawlers that don't run JavaScript see only `index.html` |

Details and remedies: [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md#known-limits).

---

## Admin panel

Visible only to accounts with the STAFF or ADMIN role (header → **Admin Portal**, or `/admin`).
ADMIN is granted only with `npm run seed -- --admin <uid>`. An ADMIN can then grant STAFF from
**Customers** — but nobody can make an ADMIN, or change their own role, from the website.

| | STAFF | ADMIN |
|---|---|---|
| Dashboard, orders, customers | ✅ | ✅ |
| Change order status (with stock deduction/restock) | ✅ | ✅ |
| Create / edit / archive products, adjust stock | ✅ | ✅ |
| Upload product images | ✅ | ✅ |
| Delete products | — | ✅ |
| Create / pause / delete coupons | view only | ✅ |
| Make someone STAFF / remove STAFF | — | ✅ |
| Suspend / reinstate a customer | — | ✅ |
| Create another ADMIN | — | command only |

The route guard is for convenience. The real enforcement is `firestore.rules`: a customer who
reached `/admin` would find every read and write refused.

---

## Project layout

```
firestore.rules          Authorization — the security boundary
firestore.indexes.json   Composite indexes (deployed with the rules)
firebase.json            Emulator configuration
scripts/
  seed-firestore.ts      Catalog upload + admin grant (Admin SDK)
tests/
  rules.test.mjs         Security rules tests
public/
  .htaccess              SPA rewrite + caching + security headers for Hostinger
src/
  components/            admin/, home/, layout/, product/, shop/, ui/
  config/site.ts         Brand, navigation, copy
  context/               Auth, Catalog, Cart, Wishlist, Toast providers
  data/                  Bundled catalog — seed source and offline fallback
  lib/                   firebase, money, coupons, catalog, storage, icons, utils
  hooks/                 useAsync (admin data loading)
  services/              Firestore access: catalog, cart, wishlist, orders, admin
  pages/                 One file per route; admin/ for the admin panel
  types/                 Shared TypeScript types
```

---

## Editing content

The catalog now lives in **Firestore**. Two ways to change it:

- **In the admin panel** — `/admin/products`. Live immediately.
- **In the Firebase console** — Firestore → `products` → edit a document.
- **In code** — edit `src/data/products.ts`, then `npm run seed`. Overwrites existing documents.

Prices are integers in **paisa**: `45200000` is Rs. 452,000. The `rs()` helper in `products.ts`
keeps the source readable.

Brand name, phone, email, address and navigation live in `src/config/site.ts`.

**Changing the shipping fee or free-shipping threshold** means editing both
`src/data/site-data.ts` and the constants at the top of `firestore.rules`, then running
`npx firebase deploy --only firestore`. If they disagree, every order is rejected.
