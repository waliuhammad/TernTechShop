# Product assets

Drop product photos here and Claude turns them into store listings.

## 1. One folder per product

```
product-assets/
  rtx-4070-super/          ← any name; lowercase-with-dashes is easiest
    1.jpg                  ← main photo (sorted by name: 1, 2, 3…)
    2.jpg
    3.png
    info.txt               ← price and stock (copy from _example/)
  logitech-g502/
    front.webp
    side.webp
    info.txt
```

**Photos**
- JPG, PNG, WebP or AVIF, **up to 5 MB each**, up to 12 per product.
- The first file by name is the main image — name them `1.jpg`, `2.jpg`… to control the order.
- Clear photos of the actual product work best. A photo of the box or the label with the model
  number helps Claude get the exact model and specs right.

**info.txt** — copy [`_example/info.txt`](_example/info.txt) into the folder and fill in at least
the price and stock. Everything else is optional.

## 2. Tell Claude

Say *"I've added products to product-assets"*. Claude will:

1. Look at the photos and your notes, and identify each product.
2. Write `product.json` in each folder: name, brand, category, performance tier, short and full
   description, highlights and specifications.
3. Show you a summary to check — especially names, prices and anything it wasn't sure about.

## 3. Approve, and they go live

After you approve, Claude runs the import, which:

- uploads the photos to your Cloudinary account (the same place admin uploads go),
- creates the products in the store — live immediately, no redeploy needed,
- remembers what it already uploaded, so running it again never duplicates photos.

Re-importing a product that already exists updates its details and photos but **keeps its live
stock count, ratings and reviews**, so it can't undo sales. Change stock in Admin → Products.

You can still edit anything afterwards in **Admin → Products**.

---

### For reference: the import command

```powershell
# Check everything without uploading or writing anything
npm run import-products

# Upload photos and create/update the products in the live store
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\terntechshop-firebase-adminsdk.json"
npm run import-products -- --commit

# Just one folder
npm run import-products -- --commit --only rtx-4070-super
```

Photos in this folder are **not committed to Git** (they live in Cloudinary once imported);
`info.txt`, `product.json` and `.uploads.json` are.
