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
| **My Account** | `/account` — edit name/phone/city, up to 10 saved addresses (one default), change password |
| **Roles** | CUSTOMER / STAFF / ADMIN, granted only via the Admin SDK |
| **Catalog** | Served from Firestore; falls back to bundled data if unreachable |
| **Cart** | Guests: in the browser. Signed in: in Firestore, live-synced across devices |
| **Cart merge** | A guest cart folds into the account on sign-in (quantities summed, clamped to stock) |
| **Wishlist** | Same guest/account model as the cart |
| **Checkout** | Three validated steps; requires sign-in; fills from a saved address |
| **Orders** | Written to Firestore, **prices and totals re-verified server-side** |
| **Order history** | Per-account, with status |
| **Search / filters / sort / pagination** | All mirrored to the URL |
| **Coupons** | Looked up by exact code, never listable; re-validated server-side on every order |
| **Reviews** | One per customer per product; hidden until staff approve; rating recalculated from approved reviews |
| **Contact form** | Saved to Firestore, shown in Admin → Inbox |
| **Warranty registration** | One registration per serial number, reviewed in Admin → Inbox |
| **Shipping settings** | Fee, free-shipping threshold and delivery zones edited in Admin → Settings |
| **Admin panel** | `/admin` — dashboard, orders, products, categories, customers, reviews, inbox, coupons, settings (see below) |

---

## Security model

A static site cannot trust the browser, so **authorization lives entirely in
[`firestore.rules`](firestore.rules)**, which Google enforces on every read and write.

The critical rule is order integrity. When a customer places an order, the rules independently:

- look up each product and reject the order if any **unit price** differs from the catalog
- recompute every **line total**, the **subtotal**, the **grand total**, and **shipping** from the fee and threshold saved in Admin → Settings
- look up the **coupon** and reject any discount it doesn't entitle
- confirm the order belongs to the **signed-in user** and starts as `PENDING`

A tampered client that submits a Rs. 452,000 graphics card at Rs. 1 is refused by the server.

The rules also prevent: reading another user's cart, wishlist, profile or orders; editing an
order after it's placed; rewriting an order's money (even as staff); enumerating coupon codes;
granting yourself a role; publishing your own review without approval; and reading someone else's
warranty registration or contact message.

**All of this is tested.** `npm run test:rules` runs 148 cases against the emulator, including
each attack above.

---

## Known limits

| Limit | Detail |
|---|---|
| 7 different products per order | Rules verify each line against the catalog, plus the coupon, suspension and shipping settings, within Firestore's 10-lookup cap. Quantities per product are not limited |
| Stock reserved at confirmation | Two shoppers can both order the last unit; only one can be confirmed |
| Image uploads via Cloudinary (unsigned) | The upload preset name is public; someone could upload images to your account, but not read or delete existing ones |
| Suspension signs out, not disables | A suspended customer is signed straight back out with a message; the rules refuse their cart, orders and reviews regardless. Disabling the Firebase account itself needs a server |
| No online payments | Cash on Delivery only |
| SEO pages refresh on deploy | Public pages and products are pre-rendered at build time from live Firestore data. Products added or edited later are still served, but their crawler copy and sitemap entry update on the next **Redeploy** |

Details and remedies: [docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md#known-limits).

---

## Admin panel

Visible only to accounts with the STAFF or ADMIN role (header → **Admin Portal**, or `/admin`).
ADMIN is granted only with `npm run seed -- --admin <uid>`. An ADMIN can then grant STAFF from
**Customers** — but nobody can make an ADMIN, or change their own role, from the website.

| | STAFF | ADMIN |
|---|---|---|
| Dashboard, orders, customers | ✅ | ✅ |
| Approve / reject reviews, handle inbox messages and warranties | ✅ | ✅ |
| Create / edit / reorder / hide categories | ✅ | ✅ |
| Change order status (with stock deduction/restock) | ✅ | ✅ |
| Create / edit / archive products, adjust stock | ✅ | ✅ |
| Upload product images | ✅ | ✅ |
| Delete products, categories, messages and warranty registrations | — | ✅ |
| Change shipping fee, threshold and zones | view only | ✅ |
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
  context/               Auth, Settings, Catalog, Cart, Wishlist, Toast providers
  data/                  Bundled catalog — seed source and offline fallback
  lib/                   firebase, money, coupons, catalog, storage, icons, utils
  hooks/                 useAsync (admin data loading)
  services/              Firestore access: catalog, cart, wishlist, orders, admin,
                         reviews, inbox, addresses, settings
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

**Changing the shipping fee, free-shipping threshold or delivery zones** — Admin → Settings.
The rules read the same saved values when checking an order, so the cart and the server always
agree and nothing needs redeploying. Categories are managed in Admin → Categories; renaming one
moves its products with it.
