# Deploying to Hostinger

Written for: whoever uploads the site — no build knowledge assumed beyond running two commands.

---

## 1. Build

**Connect Firebase first** — see [FIREBASE-SETUP.md](FIREBASE-SETUP.md). Your Firebase keys are
compiled into the bundle at build time, so `.env` must be filled in, with
`VITE_USE_FIREBASE_EMULATOR=0`, **before** you build.

```bash
npm install
npm run build
```

This produces `dist/`:

```
dist/
  .htaccess          <- hidden file. It MUST be uploaded.
  index.html
  favicon.svg
  assets/            <- hashed JS and CSS
```

## 2. Upload

**hPanel → Files → File Manager → `public_html`**

1. Delete whatever is currently in `public_html` (back it up first if it matters).
2. Enable hidden files: **Settings → Show hidden files (dotfiles)**.
   Without this the File Manager will silently skip `.htaccess`.
3. Upload the **contents of `dist/`** — not the `dist` folder itself.
   `index.html` must sit directly inside `public_html`.

Zip upload is faster: zip the contents of `dist/`, upload the zip, then Extract in place.
Confirm `.htaccess` survived extraction.

Prefer FTP? Point FileZilla at `public_html` and drag the contents of `dist/` across, with
"show hidden files" enabled.

## 3. Verify

Open the site and check each of these:

- [ ] Homepage loads, fonts look right (Inter), header turns solid on scroll
- [ ] **Reload the page while on `/shop`** — it must load the shop, not a 404
- [ ] Same for `/cart`, `/about`, and a product URL
- [ ] Register an account, sign out, sign back in
- [ ] Add a product to the cart, reload, cart still holds it
- [ ] Complete a checkout — the order appears under **Firestore → `orders`**
- [ ] Open it on a phone: menu opens, no sideways scrolling

**The deep-link check matters most.** The reference site fails it — visiting
`terntechshop.com/shop` directly returns the host's 404 page, because a single-page app has no
real file at that path. `.htaccess` is what fixes it, by routing unknown paths to `index.html`.
If deep links 404 on your upload, `.htaccess` did not make it into `public_html`.

---

## Deploying into a subfolder

To serve from `example.com/shop/` rather than the domain root, build with the base path set:

```bash
# macOS / Linux
VITE_BASE=/shop/ npm run build

# Windows PowerShell
$env:VITE_BASE="/shop/"; npm run build
```

Then edit the `RewriteBase` line in `dist/.htaccess` to match:

```apache
RewriteBase /shop/
```

Upload into `public_html/shop/`.

---

## Updating the site later

**Products, prices and stock** live in Firestore — edit them in the Firebase console and the
change is live immediately. No rebuild or upload needed.

**Design, copy, pages or security rules** need a rebuild:

1. Edit the code (`src/`), or `firestore.rules` then `npx firebase deploy --only firestore`
2. `npm run build`
3. Re-upload the contents of `dist/`

Filenames in `assets/` are content-hashed, so browsers pick up changes immediately.
`index.html` is served with `no-cache` by the supplied `.htaccess`, which is what makes that work
— don't add caching rules for it.

---

## What `.htaccess` does

| Block | Purpose |
|---|---|
| HTTPS redirect | Forces `https://` |
| SPA fallback | Routes any non-file path to `index.html` so client-side routing works |
| Compression | gzip for HTML, CSS, JS, JSON, SVG |
| Caching | One year for hashed assets; `no-cache` for `index.html` |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS |

If your plan runs LiteSpeed (Hostinger's default) every directive above is supported.

---

## If sign-in works locally but not on the live site

Add your domain under **Firebase Console → Authentication → Settings → Authorized domains**.
Firebase refuses sign-in from any domain not on that list, and the error only appears once
deployed.
