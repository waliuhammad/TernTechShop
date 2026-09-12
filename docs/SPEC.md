# Tern Tech Shop — Implementation Specification

Derived from inspection of the live reference at `https://terntechshop.com` (desktop 1440px + mobile 390px, rendered DOM outlines + published CSS/JS bundle). Everything below is **observed**, not assumed.

---

## 0. What the reference actually is

| Property | Observed |
|---|---|
| Delivery | Client-rendered Vite + React SPA on Hostinger/LiteSpeed. `index.html` is a 400-byte shell. |
| Styling | **Tailwind CSS v4** (`@layer theme` tokens in the published CSS) |
| Fonts | **Inter** (300–900) + **JetBrains Mono** (400,500), via Google Fonts |
| Animation | Framer Motion (`initial/animate/exit`, scale + x/y offsets) |
| Icons | Lucide |
| Backend | External JSON API at `tern-technologies.vercel.app/api` |
| Market | Pakistan. Currency **PKR**, rendered `Rs. 1,600`. Payment = **Cash on Delivery**. |
| Catalog size | 203 products, 6 categories, 4 performance tiers |

### Voice

The single most defining characteristic. It is **not** a generic shop — it is an industrial / "hardware deployment terminal" register. Products are *components* or *units*, the catalog is a *registry* or *manifest*, orders are *deployments*, shipping is *logistics*, checkout is *Authorize Deployment*, the cart is the *Hardware Cart*. Monospace carries system-ish metadata (`// SYSTEM_REGISTRY_ACCESS: GRANTED`, `Unit_ID: 69f21a9a`, `LOGISTICS_MANIFEST_V4`).

Reproducing this voice matters as much as reproducing the layout.

---

## 1. Design tokens (extracted verbatim from the published CSS)

```
--color-primary:        #1d4ed8   /* blue-700  */
--color-primary-hover:  #1e40af   /* blue-800  */
--color-secondary:      #f97316   /* orange-500 — sale badge */
--color-tech-slate:     #f8fafc   /* slate-50  — PDP page ground */
--color-tech-deep:      #ffffff
--color-tech-blue:      #2563eb   /* blue-600  — PDP accent */
--color-tech-cyan:      #0891b2   /* cyan-600  — stock / "stable" state */
```

- Body: `bg-slate-50`, `text-slate-900`, Inter, antialiased.
- Overridden type scale: `--text-3xl` line-height `1.2`; `--text-base` line-height `1.5`.
- Radii in use: `md .375` `lg .5` `xl .75` `2xl 1rem` `3xl 1.5rem`, plus arbitrary `[2rem]` `[3rem]` `[4rem]`.
- Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`. Section rhythm: `py-24`, heading block `mb-16`.

### Custom component classes (reproduce exactly)

```css
.primary-btn   { border-radius:.5rem; background:var(--color-primary); padding:.75rem 2rem;
                 font-weight:700; color:#fff; transition:all .2s; }
.secondary-btn { border-radius:.5rem; border:1px solid var(--color-slate-200); background:#fff;
                 padding:.75rem 2rem; font-weight:700; color:var(--color-slate-900); transition:all .2s; }
.tech-btn      { background:var(--color-slate-900); font-weight:700; color:#fff; transition:all; }
.section-label { display:inline-block; margin-bottom:1rem; border-radius:.375rem;
                 background:var(--color-blue-50); padding:.25rem .75rem; font-size:10px;
                 font-weight:700; letter-spacing:.1em; color:var(--color-primary); text-transform:uppercase; }
.badge-sale    { position:absolute; top:1rem; left:1rem; z-index:10; background:var(--color-orange-500);
                 padding:.25rem .5rem; font-size:10px; font-weight:700; letter-spacing:.05em;
                 color:#fff; text-transform:uppercase; border-radius:.25rem; }
.badge-new     { /* identical, background:var(--color-emerald-500) */ }
.tech-grid     { background-image:linear-gradient(#e2e8f080 1px,transparent 1px),
                                 linear-gradient(90deg,#e2e8f080 1px,transparent 1px);
                 background-size:50px 50px; }
```

### The signature heading treatment

Every store-side section heading is:

`text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic`

with **one accent word** wrapped in `<span class="text-primary not-italic">`. Hero and PDP scale up to `text-6xl md:text-8xl leading-[0.9]`. Body copy under a heading often carries `border-l-2 border-slate-100 pl-6` and is `italic`.

### Two themes, deliberately

- **Store surfaces** (home, shop, product, cart, login, wishlist, checkout, orders): light — white / `slate-50`, heavy italic uppercase headings.
- **Information surfaces** (shipping, warranty, about, contact, legal): dark — `slate-950`/`slate-900` panels, `slate-400` body, `blue-400`/`emerald-400` mono eyebrow pills, and notably **non-italic `font-bold tracking-tight`** headings. A softer register, on purpose.

---

## 2. Sitemap (as observed in the router)

**Store**

```
/                         Home
/shop                     Catalog. Category via query: /shop?category=Processors
/product/:id              Product detail
/cart                     Cart
/checkout                 3 steps: Shipping → Payment → Review
/order-confirmation/:id   Post-order
/orders                   My deployments
/wishlist                 Saved components
/inventory                Full inventory manifest
/login                    Login + register (toggle)
```

**Information (dark)**

```
/shipping   Logistics & Deployment
/warranty   Warranty Registry (serial-number registration form)
/about      Technical Heritage
/contact    Contact Engineer
/legal      Single page, hash sections: #terms #privacy #returns #cookies
```

**Admin** — `/admin-login`, then `/admin/*` with sidebar:

```
/admin  /admin/products  /admin/orders  /admin/users  /admin/warranties  /admin/settings
```

> The reference has **no** `/category/[slug]`, `/privacy`, `/terms`, `/refund` or `/account/*` routes. I follow the reference and add 301 redirects from those conventional URLs to the real ones.

---

## 3. Page-by-page layout

### Header — `nav.fixed top-0 z-[1000] transition-all duration-500`

- **No announcement bar.** (Verified — do not invent one.)
- At scrollY ≤ 20: `bg-transparent py-6`. Past 20: `bg-white/90 backdrop-blur-xl border-b border-slate-100 py-3 shadow-sm`.
- Logo: `w-10 h-10 rounded-xl` icon tile — `bg-white text-primary` at top, `bg-primary text-white` once scrolled; `group-hover:scale-110 group-hover:rotate-6`. Wordmark `TERN` (`font-black italic uppercase tracking-tighter text-2xl`) + `TECHNOLOGIES` (`text-primary not-italic font-medium`).
- Nav (`hidden lg:flex space-x-10`, `font-bold text-[11px] uppercase tracking-widest text-slate-600`): **Hardware** `/shop` · **Logistics** `/shipping` · **Warranty** `/warranty` · **About** `/about`. Hover = underline bar growing `w-0 → w-full`, `h-1 bg-primary rounded-full`, at `-bottom-1`.
- Actions: search (`hidden md:flex`) · wishlist (rose dot when non-empty) · cart (count badge `-top-1 -right-1 w-5 h-5 bg-primary text-[9px] font-black rounded-full`, springs in from scale 0) · then **Admin Portal** / (orders + logout) / **Login Hub** by auth state · hamburger (`lg:hidden`).
- Mobile menu: full-screen `fixed inset-0 z-[999] bg-white p-6 pt-24`, links at `text-4xl font-black uppercase italic tracking-tighter`. Scale + fade in.
- `main` carries `pt-20`; the first section additionally carries `mt-20`.

### Home — 7 sections, in this order

1. **Hero** `relative min-h-[600px] md:h-[750px] flex items-center` — background photo at `opacity-10` under `bg-gradient-to-r from-white via-white/40 to-transparent`. Left: pill *INDUSTRIAL HARDWARE DISTRIBUTION* → `h1` **PERFORMANCE** / **REFINED.** (second line `text-primary not-italic`) → paragraph → `Explore Components →` (primary) + `Our Heritage` (secondary) → 3 stats above a `border-t border-slate-100`: **Enterprise**/SECURITY GRADE, **24/7**/SUPPORT TECH, **Pakistan**/WIDE DELIVERY. Right (`hidden md:block`): `w-[450px] aspect-square bg-slate-50 rounded-[4rem] border shadow-3xl p-12` product shot, with a pulsing `bg-primary` circular badge at `-top-6 -right-6` and a `bg-primary/5 blur-[100px]` bloom behind. Bottom-right: vertical **SCROLL MANIFEST** rail (`lg` only).
2. **Shop by Category** — `py-24 bg-slate-50 border-b`. Label *REGISTRY STRUCTURE*. Grid `1 / md:2 / lg:3 gap-8`, 6 cards: `bg-white p-10 rounded-2xl border-slate-100 hover:border-primary/20 hover:shadow-2xl`, a `-top-10 -right-10 w-40 h-40 bg-slate-50 rounded-full` blob that turns `primary/5` on hover, a `w-20 h-20 bg-slate-900 rounded-2xl` icon tile that turns `bg-primary` over 500ms, and a CTA row whose `gap-3 → gap-5` on hover.
3. **Featured Components** — label *INVENTORY MANIFEST*, right-aligned `Browse Full Registry →`. Grid `1 / sm:2 / lg:4 gap-8`.
4. **Built for Enterprise Execution** — `lg:grid-cols-2 gap-20`. Pill *INFRASTRUCTURE ARCHITECTURE*, `h2 text-5xl md:text-7xl`, then a `sm:grid-cols-2 gap-8` of 4 feature cards: **Secure-Boot**, **Optimized Latency**, **Nationwide Logistics**, **Uptime Monitor**. Right: `aspect-[4/5] rounded-[3rem]` image panel between two `blur-[100px]` bloom circles.
5. **Shop by Infrastructure Tier** — label *PERFORMANCE TIERS*. Grid `1 / sm:2 / lg:4 gap-8` of `rounded-[2rem] p-4 pb-10` cards whose `aspect-[4/3] rounded-[1.5rem] bg-slate-50` media area goes `bg-slate-900` on hover. Tiers: **Essential** (blue) · **Professional** (cyan) · **Enterprise** (emerald) · **Extreme** (orange).
6. **Brand strip** — `py-16 border-y bg-slate-50/50`, `opacity-60 hover:opacity-100 duration-700`, `text-3xl font-black tracking-tighter italic`: INTEL_CO · AMD_RZN · NVIDIA_G · ASUS_ROG · CORSAIR_V.
7. **Footer** — `bg-slate-900 pt-24 pb-12`, 4 columns `gap-16`. Column headers are `font-bold uppercase tracking-widest text-xs text-primary border-l-2 border-primary pl-4` (the Contact column uses `blue-400`). Columns: brand blurb · **Registry Hub** · **Support Protocol** · **Contact Terminal** (HQ address, `0316458 7553`, `info@terntechshop.com`). Bottom bar above `border-t border-white/5`: `text-[10px] font-mono uppercase tracking-[0.2em]` — `© 2026 Tern Technologies Distribution Group // All Protocols Reserved.` + 3 legal links.

### Product card (shared by home + shop + wishlist)

```
group bg-white rounded-xl border border-slate-200 overflow-hidden
hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 transform-gpu
├ aspect-[4/5] p-8, object-contain image, scales on hover
├ badge top-4 left-4 (Featured / Sale / New)
├ quick actions: inset-x-4 bottom-4, translate-y-24 → 0 over 500ms on hover
└ p-6 space-y-4 — category + rating row
                · h3 (line-clamp-2 min-h-[3rem] text-lg font-bold, → text-primary on hover)
                · price row on border-t border-slate-50
```

### Shop `/shop`

- Page header on white, `py-24 mt-20`, bg image `opacity-5`: `h1` **HARDWARE MANIFEST** (`text-5xl md:text-6xl font-black italic uppercase tracking-tighter`) + mono subtitle `// SYSTEM_REGISTRY_ACCESS: GRANTED`.
- Body `bg-slate-50 pb-32`, `flex flex-col lg:flex-row gap-16`.
- **Sidebar** `lg:w-80 space-y-12`: search input (`pl-12 py-4 rounded-xl`) · **Categories** (6) · **Performance Tiers** (4) · `Reset Registry Parameters` · dark `rounded-3xl` CTA card *Custom Configuration?* → `Consult Engineer`.
- **Results header**: *MANIFEST REGISTRY* / **AUTHORIZED UNITS**; right side sort `<select>` + a large `text-4xl font-black italic` count over *DETECTED UNITS IN REGISTRY*.
- Grid `1 / sm:2 / lg:3 gap-8`. Sort: Featured, Newest, Price: Low to High, Price: High to Low.
- Empty state: *Null Search Results* — "The registry could not locate any active artifacts matching your current parameters."

### Product `/product/:id`

- Page ground `bg-tech-slate tech-grid` (the 50px grid). `lg:grid-cols-2 gap-20 items-start`.
- **Left, `lg:sticky lg:top-32`**: `aspect-square rounded-3xl bg-white border shadow-2xl p-16` with a mono `Unit_ID: <8 hex>` chip at `inset-x-8 top-8` and two pulsing dots (cyan, blue). Thumbnails `w-28 h-28 rounded-xl border-2`; active = `border-tech-blue shadow-[0_0_20px_rgba(59,130,246,.2)]`, inactive = `border-slate-100 opacity-60`.
- **Right**: category chip (mono) + rating box (*Verified Signals: N*) → `h1 text-6xl md:text-8xl font-black italic uppercase leading-[0.9]` → price `text-5xl font-black text-primary` + rotated divider + *Excl. Deployment VAT* → description in `border-l-4 border-tech-blue pl-8 bg-blue-50 rounded-r-xl` → quantity stepper (`w-14 h-14` buttons, mono value) beside mono stock line *N Units Stable in Inventory* (`text-tech-cyan`) → `tech-btn h-20` **Initialize Checkout** with a sheen sweep, plus `w-20 h-20` wishlist square → 3 trust tiles: **Secure-Boot**, **Max Clock**, **30D RMA**.
- **Reviews** (`mt-40`): *USER DEPLOYMENTS* / `// FEEDBACK_STREAM: ENCRYPTED`, an *Architecture Trust* score card, a submit form (gated — *Authentication Header Required*), and the review list.

### Cart / Checkout / Orders

- Empty cart: **Your hardware cart is empty!** / *Your architecture is waiting to be built. Start your journey today!* / `Browse Components`.
- Checkout steps: **Shipping → Payment → Review**. Fields use consignee language: *Full Consignee Name*, *Deployment Address*, *Deployment City*, *Funding Protocol*. CTA `Authorize Deployment`; footer micro-label *ENTERPRISE SOURCED HARDWARE*.
- Reference settings: `freeShippingThreshold = 5000`, `shippingFee = 250` (PKR), admin-editable (*Free Logistics Threshold (Rs)*, *Standard Logistics Fee (Rs)*).
- Confirmation: **Order Confirmed!** / *Your hardware manifest is now in our logistics pipeline.*

### Information pages (dark)

- **/shipping** — pill `LOGISTICS_MANIFEST_V4`, 3 cards (Static Shielding · Real-time Check · Tracked Arrival), then **Shipping Zones**:

  | Sector | Delivery Window | Carrier Protocol |
  |---|---|---|
  | Islamabad / Rawalpindi | 1–2 Days | Same-Day Express |
  | Lahore / Karachi / Peshawar | 2–3 Days | TCS / Leopard |
  | All Other Cities | 3–5 Days | M&P / PostEx |

- **/warranty** — pill `WARRANTY_REGISTRY_V1.1`, dark form (*Serial Number (S/N)*, *Purchase Manifest ID*) → `AUTHENTICATE & REGISTER`; benefit cards *Anti-Tamper Protocol*, *Priority RMA*.
- **/about** — pill `SYSTEM_HISTORY_LOG`, **Technical Heritage**; blocks *The Silicon Foundation*, *Pakistan Infrastructure*, *Our Mission*.
- **/contact** — pill `ENGINEER_ON_CALL`, **Contact Engineer**; *Secure Channel* / *Emergency Uplink* / *Physical Core*; form with subject options (Bulk Deployment Query · Technical Implementation Hub · Warranty Claim Escalation · Other / General) → `TRANSMIT MANIFEST`.
- **/legal** — **Legal Compliance Center**, gradient-clipped heading, 4 anchored sections.

---

## 4. Deliberate deviations (and why)

| # | Reference behaviour | What was built | Reason |
|---|---|---|---|
| 1 | `/shop` renders all 203 products in one grid — a **39,533px** page | Pagination, 12 per page | Performance. Visual language unchanged. |
| 2 | Deep links (`/shop`, `/cart`) return the host's 404 — SPA with no rewrite rule | `public/.htaccess` ships an SPA fallback in `dist/` | A real bug in the reference. Ours does not have it. |
| 3 | Mobile hero `text-6xl` overflows horizontally at 390px | `clamp()` type scale; full wordmark drops below `sm` | Verified: zero horizontal overflow at 390px. |
| 4 | Login form | Local operator profile, **no password collected** | A static build has no server to verify a credential; storing one in `localStorage` would be unsafe. |
| 5 | Conventional URLs (`/privacy`, `/category/x`) don't exist | Redirects to `/legal#privacy`, `/shop?category=x` | Honours the reference while keeping expected URLs working. |
| 6 | Filters held in component state | Filters, sort and page mirrored into the query string | Makes catalog views shareable and bookmarkable. |

---

## 5. Stack (as built)

Vite 8 · React 19 · TypeScript strict · Tailwind CSS v4 · React Router 7 · Framer Motion ·
Lucide. No backend — the build output is a static `dist/` folder.

Routes are lazily loaded per page; React, Framer Motion and Lucide are split into separate
vendor chunks so repeat visitors re-download only application code.

---

## 6. Data model

Static TypeScript modules rather than a database:

- `src/data/products.ts` — catalog. Money is an integer count of **paisa**; `formatPrice`
  renders the reference's `Rs. 1,600` format.
- `src/data/categories.ts` — the six departments.
- `src/data/site-data.ts` — shipping zones, logistics thresholds, coupons, reviews, legal copy.
- `src/config/site.ts` — brand, navigation, tiers, standing copy.

Browser state lives in `localStorage` behind `src/lib/storage.ts`, which swallows quota and
private-mode failures so a blocked write can never white-screen the storefront:

| Key | Holds |
|---|---|
| `terntech.cart.v1` | Cart lines |
| `terntech.wishlist.v1` | Wishlist ids |
| `terntech.orders.v1` | Placed manifests |
| `terntech.profile.v1` | Operator profile |

---

## 7. Verification performed

- **Build** — clean; TypeScript strict, no errors.
- **Lint** — no errors. Four `only-export-components` fast-refresh hints remain on the context
  files (the idiomatic provider + hook pattern); these are dev-only DX notes.
- **Functional** — 22/22 automated checks: search, category filter, price sort, pagination,
  add-to-cart, cart totals, coupon, free-shipping threshold, checkout validation, all three
  checkout steps, order creation, cart clearing, order history, wishlist persistence across
  reload, redirects, 404.
- **Mobile interaction** — 9/9: menu open/close, scroll lock and release, navigation, filter
  drawer, touch add-to-cart.
- **Responsive** — 13 routes × {390px, 1440px}: no horizontal overflow, no console errors,
  no page errors.
