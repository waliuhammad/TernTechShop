# Connecting Firebase

Written for: whoever sets up the live store — about 20 minutes, no prior Firebase experience
assumed.

Until this is done the site still works, but runs on the bundled catalog with sign-in disabled.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**
2. Name it (e.g. `tern-technologies`). Google Analytics is optional.

The free **Spark** plan covers everything in this guide.

## 2. Turn on email sign-in

**Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**

Then **Settings → Authorized domains → Add domain** and add:

- `terntechshop.com`
- `www.terntechshop.com`

Skip this and sign-in fails on the live site with `auth/unauthorized-domain`, even though it
works on localhost.

## 3. Create the database

**Build → Firestore Database → Create database**

- Location: **`asia-south1` (Mumbai)** — the closest region to Pakistan. This cannot be changed
  later.
- Start in **production mode**. The rules you deploy in step 5 replace the defaults.

## 4. Register the web app and copy its keys

**Project settings (⚙) → General → Your apps → Web (`</>`)** → register it (skip Hosting).

You'll be shown a `firebaseConfig` object. In the project folder:

```bash
cp .env.example .env
```

Paste each value into `.env`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=tern-technologies.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tern-technologies
VITE_FIREBASE_STORAGE_BUCKET=tern-technologies.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
VITE_USE_FIREBASE_EMULATOR=0
```

> **These keys are public, and that is normal.** Every Firebase web app ships them in its
> JavaScript. They identify the project — they don't grant access. Access is controlled by the
> security rules in the next step.

## 5. Deploy the security rules and indexes

**This step is not optional.** The rules are what stop a visitor from editing prices or reading
other people's orders.

```bash
npx firebase login
npx firebase use --add        # pick your project, alias it "default"
npx firebase deploy --only firestore
```

This uploads `firestore.rules` and `firestore.indexes.json`. Indexes take a few minutes to
build — until they finish, the Orders page shows "Could not reach the manifest registry".
Watch progress under **Firestore → Indexes**.

## 6. Load the catalog

The seed script uploads the products, categories and coupons from `src/data/`. It writes with
admin privileges, so it needs a service-account key.

1. **Project settings → Service accounts → Generate new private key**
2. Save the file **outside this project folder**, e.g. `C:\keys\tern-admin.json`

> **This file is a master key to your entire project.** Never commit it, email it, or put it in
> `.env`. `.gitignore` blocks common filenames as a backstop, but keeping it outside the repo is
> the real protection.

Run:

```powershell
# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\tern-admin.json"
$env:FIREBASE_PROJECT_ID="tern-technologies"
npm run seed
```

```bash
# macOS / Linux
GOOGLE_APPLICATION_CREDENTIALS=~/keys/tern-admin.json FIREBASE_PROJECT_ID=tern-technologies npm run seed
```

You should see `products: 33`. Re-running is safe — it overwrites rather than duplicates.

## 7. Make yourself an admin

1. Run the site (`npm run dev`), open **Login Hub**, and **Register** your own account.
2. In the console, **Authentication → Users** — copy your **User UID**.
3. Grant the role:

```powershell
npm run seed -- --admin YOUR_USER_UID
```

Roles can only be granted this way. The security rules forbid anyone — admins included — from
granting a role through the website, so a compromised account can't promote itself.

## 8. Build and upload

```bash
npm run build
```

Upload the contents of `dist/` to `public_html` as described in
[DEPLOYMENT.md](DEPLOYMENT.md). **Build after filling in `.env`** — the keys are compiled into the
bundle at build time, so a `dist/` built before step 4 won't connect.

---

## Checklist

- [ ] Email/Password sign-in enabled
- [ ] `terntechshop.com` added to Authorized domains
- [ ] Firestore created in `asia-south1`
- [ ] `.env` filled in, `VITE_USE_FIREBASE_EMULATOR=0`
- [ ] `firebase deploy --only firestore` run, indexes finished building
- [ ] `npm run seed` shows 33 products
- [ ] Your account granted ADMIN
- [ ] Service-account key stored outside the project folder
- [ ] `npm run build` run **after** `.env` was filled in

---

## Managing the store

Sign in with your admin account and use **Admin Portal** in the header (or go to `/admin`).

| Screen | What you can do |
|---|---|
| **Dashboard** | Revenue, orders awaiting action, 7-day sales, low-stock alerts |
| **Orders** | Search and filter; open an order to call or WhatsApp the customer, confirm, ship, deliver or cancel |
| **Products** | Create, edit, archive or delete; upload images; click a stock number to adjust it inline |
| **Customers** | Every account with order count and spend. ADMIN can **make staff / remove staff** and **suspend / reinstate** customers |
| **Coupons** | Create percentage or fixed-amount codes, pause or delete them (ADMIN only) |

**Stock is deducted when you confirm an order**, not when the customer places it. If a product
has sold out since the order came in, confirmation is refused so you can call the customer
first. Cancelling a confirmed order puts the units back.

**Staff and suspensions.** On **Customers**, an ADMIN can make any customer STAFF (or remove it),
and suspend or reinstate a customer. A new staff member must sign out and back in to see the
Admin Portal. Staff and admins can't be suspended — remove the role first.

**Images.** Connect Cloudinary to get an **Upload images** button — see
[CLOUDINARY-SETUP.md](CLOUDINARY-SETUP.md). Without it, paste image URLs.

If the admin panel says **Access denied**, sign out and back in — the role is read at sign-in.
If it still refuses, the grant didn't land: re-run `npm run seed -- --admin YOUR_UID` on one line.

---

## Developing locally without touching the live project

The Firebase Emulator Suite runs Auth and Firestore on your machine. It needs **Java 11+**.

```bash
npm run emulators                       # terminal 1 — UI at http://127.0.0.1:4000
```

```powershell
# terminal 2 — load the catalog into the emulator (no credentials needed)
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:FIREBASE_PROJECT_ID="demo-terntech"; npm run seed
```

Then `npm run dev:emulator`. That mode reads `.env.emulator.local` (demo project, emulator on),
which overrides your real keys **only for that command** — your live `.env` stays untouched, and
`npm run build` never reads the emulator file.

### Rules tests

```bash
npm run emulators      # terminal 1
npm run test:rules     # terminal 2
```

Run these after any change to `firestore.rules`. They include the attacks that matter — forged
prices, forged totals, invented coupons, reading another user's orders, self-promotion to admin.

---

## Known limits

| Limit | Why | Lifting it |
|---|---|---|
| **At most 8 distinct products per order** | Rules re-check each line's price against the catalog, and Firestore caps a rule at 10 document lookups | Cloud Functions |
| **Stock is reserved at confirmation, not at checkout** | Rules can approve a write but cannot perform a second one, so a customer's order can't decrement stock itself. Two shoppers can both *place* an order for the last unit — but only one can be *confirmed*; the admin panel refuses the second | A Cloud Function on order creation, to reserve at checkout |
| **Image uploads use an unsigned Cloudinary preset** | No server to sign uploads. The preset name is public, so someone could upload to your account (not read or delete) | Blaze plan + a signing function |
| **Suspension is soft** | Disabling sign-in itself needs the Admin SDK on a server. A suspended customer can sign in, but cart and ordering are refused by the rules | Blaze plan + a function calling `updateUser({ disabled: true })` |
| **Changing the shipping fee takes two edits** | The fee is in both `src/data/site-data.ts` and `firestore.rules`, so the rules don't spend a lookup reading it | Edit both, then redeploy rules |

Lifting the first two needs **Cloud Functions**, which require the **Blaze** plan. Blaze is pay-as-you-go
with the same free allowance as Spark, so a store at this scale typically pays nothing — but it
does require a billing card on file. Until then, confirm availability when you call the customer
to confirm their order.
