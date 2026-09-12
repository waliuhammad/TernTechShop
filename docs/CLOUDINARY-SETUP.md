# Connecting Cloudinary (product image uploads)

Written for: whoever manages the store — about 10 minutes, free, no card needed.

Until this is done, the admin panel's product editor still works: you add images by pasting a
URL. Connecting Cloudinary adds an **Upload images** button.

---

## 1. Create a free account

Sign up at <https://cloudinary.com/users/register_free>. The free plan is plenty for a store
catalogue (25 monthly credits — roughly 25 GB of storage or bandwidth).

## 2. Find your cloud name

On the Cloudinary **Dashboard** (home page after signing in), copy the **Cloud name** — a short
word like `dxyz12abc`.

> Ignore the **API Key** and **API Secret** shown next to it. This site never needs them, and the
> **API Secret must never go in `.env`** — anything in `.env` ends up in the public website files.

## 3. Create an unsigned upload preset

**Settings (gear icon) → Upload → Upload presets → Add upload preset**

| Setting | Value | Why |
|---|---|---|
| **Upload preset name** | something not guessable, e.g. `tern_products_7k2q` | It's visible in the site's code; an obscure name makes casual misuse less likely |
| **Signing mode** | **Unsigned** | A static site has no server to sign uploads |
| **Asset folder** | `terntech/products` | Keeps store images together |

Save it and copy the preset name. Those three settings are all the site needs.

**Optional hardening**, if your Cloudinary screen offers them (newer accounts may not show
these on the preset page — skip them if you can't find them):

| Setting | Value | Why |
|---|---|---|
| **Allowed formats** | `jpg, png, webp, avif` | Cloudinary itself refuses non-images |
| **Incoming transformation** | limit to `2000` px (crop mode *limit*) | Huge photos are shrunk on arrival |

The site already refuses anything that isn't a JPG/PNG/WebP/AVIF under 5 MB before uploading;
these add the same check on Cloudinary's side, against someone bypassing the site.

## 4. Add both values to `.env`

Your `.env` already has these two lines at the bottom — fill them in:

```env
VITE_CLOUDINARY_CLOUD_NAME=dxyz12abc
VITE_CLOUDINARY_UPLOAD_PRESET=tern_products_7k2q
```

Then restart `npm run dev`, or rebuild with `npm run build` and re-upload `dist/` for the live
site.

## 5. Check it

**Admin Portal → Products → Edit any product → Images → Upload images.** Pick a photo; it
appears in the grid with a **Main** badge if it's the first. Save the product.

---

## How it behaves

- JPG, PNG, WebP or AVIF, **up to 5 MB each**, up to **12 images** per product.
- The first image is the one on product cards. Hover an image and click **☆** to make it the
  main one, or **✕** to remove it.
- Images are served through Cloudinary with automatic format and quality, capped at 1600px wide,
  so shoppers download a light file even when you upload a large photo.
- **Removing an image from a product does not delete it from Cloudinary.** Clean up old files
  in the Cloudinary **Media Library** occasionally if storage matters.

## The one trade-off

An unsigned preset means the cloud name and preset name are readable in the site's JavaScript.
Someone determined could use them to **upload** images to your Cloudinary account. They **cannot**
see, change or delete your existing images, and the preset settings above limit what they can
send.

If it's ever abused: delete that preset in Cloudinary, create a new one with a different name,
update `.env`, rebuild and re-upload. Old product images keep working.

(The fully locked-down version — uploads signed by a server — needs Firebase's Blaze plan.)
