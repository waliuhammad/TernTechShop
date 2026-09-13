# JazzCash & Easypaisa payments

Customers can pay by **Cash on Delivery**, **JazzCash** or **Easypaisa**. For a wallet payment
they enter their mobile number (JazzCash also asks for the last 6 digits of their CNIC), approve
the prompt on their phone, and the order page turns to **Paid** by itself.

This needs the small **payment server** in [`server/`](../server), because the merchant
credentials must stay secret and a static website can't keep a secret.

```
Customer's browser ──(1) places order, stock reserved──▶ Firestore  (paymentStatus: UNPAID)
        │
        └──(2) "charge my order" + login token──▶ api.terntechshop.com  (server/)
                                                    │  reads the amount from the order
                                                    │  signs the request with your keys
                                                    ▼
                                             JazzCash / Easypaisa ──▶ prompt on customer's phone
                                                    │
                   Firestore  ◀──(3) PAID / FAILED ─┘   order page updates live
```

- The amount always comes from the order in the database, never from the browser.
- Only the server can mark an order paid — the database rules refuse it from anyone else, staff included.
- CNIC digits are passed straight to JazzCash and never stored. Wallet numbers are saved masked (`0300****567`).
- Unpaid wallet orders are cancelled automatically after **30 minutes** and their stock returned.
- If a gateway doesn't give a clear answer, the server asks again every 30 seconds. If it still
  can't confirm after 20 minutes, the order is marked **Check payment** for a person to look at —
  it is never guessed as paid or failed.

---

## What you need

| From | Values |
|---|---|
| **JazzCash** merchant portal → Integration | Merchant ID, Password, Integrity Salt — and **Mobile Wallet REST API v2.0** enabled on the account |
| **Easypaisa** merchant team | Store ID, API username and password for the **Mobile Account (MA) REST API**, and your merchant account number |
| **Firebase** | A service-account key: Firebase Console → Project settings → Service accounts → **Generate new private key** |

Ask both gateways to confirm the API above is enabled for your merchant account. Many merchant
accounts start with only hosted checkout; wallet API access is often a separate request.

---

## 1. Create the payment server on Hostinger

1. Make the upload: from the project folder run

   ```powershell
   git archive --format=zip -o ..\TernTechShop-api.zip HEAD:server
   ```

   (or ask Claude for a fresh `TernTechShop-api.zip`).
2. hPanel → **Websites → Add Website → Deploy Web App → Upload your website files** → the zip.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework | **Express** |
   | Build command | `npm run build` |
   | Output directory | leave default / `dist` if asked |
   | Entry file | `dist/index.js` |
   | Node version | 22.x |

4. Domain: choose or create the subdomain **`api.terntechshop.com`**.
5. Before deploying, open **Environment variables** and add the values below.

### Environment variables

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON file contents (or its Base64) |
| `FIREBASE_PROJECT_ID` | `terntechshop` |
| `ALLOWED_ORIGINS` | `https://terntechshop.com,https://www.terntechshop.com` |
| `JAZZCASH_MERCHANT_ID` | from JazzCash |
| `JAZZCASH_PASSWORD` | from JazzCash |
| `JAZZCASH_INTEGRITY_SALT` | from JazzCash |
| `EASYPAISA_STORE_ID` | from Easypaisa |
| `EASYPAISA_USERNAME` | from Easypaisa |
| `EASYPAISA_PASSWORD` | from Easypaisa |
| `EASYPAISA_ACCOUNT_NUMBER` | your Easypaisa merchant account number |

The live gateway addresses are the defaults. Every other setting is optional — see
[`server/.env.example`](../server/.env.example). A wallet with any credential missing is simply
switched off, so you can go live with one and add the other later.

> **Never** put these values in the website's `.env`, in a `VITE_` variable, or in Git. The
> service-account key gives full access to your database.

6. **Deploy**. When it finishes, open `https://api.terntechshop.com/health`. You should see:

   ```json
   {"ok":true,"providers":["JAZZCASH","EASYPAISA"]}
   ```

   A wallet missing from `providers` means one of its variables is empty.

### Whitelist the server's IP

JazzCash and Easypaisa usually only accept API calls from IP addresses you register with them.
Open **Runtime logs** for the API web app and find the line

```
[api] outbound IP for gateway whitelisting: 1.2.3.4
```

Send that IP to both gateways' merchant support and ask them to whitelist it for the wallet API.
Payments will fail (usually with an HTTP or "unauthorised" error in the logs) until they do.

---

## 2. Point the website at it

1. In the website's `.env` add:

   ```
   VITE_PAYMENTS_API_URL=https://api.terntechshop.com
   ```

2. Deploy the database rules (orders can now be JazzCash / Easypaisa):

   ```
   npx firebase deploy --only firestore
   ```

3. Build a new website zip and **Redeploy** the storefront on Hostinger, as usual.

Checkout now shows JazzCash and Easypaisa next to Cash on Delivery. If the payment server is
ever down, checkout quietly falls back to Cash on Delivery only.

---

## 3. Test with real money, safely

1. In **Admin → Products**, create a hidden test product priced at **Rs. 10** (or temporarily set
   a cheap product to Rs. 10). Set free shipping from Rs. 0 in Settings if you don't want the fee
   added — and set it back afterwards.
2. Place an order with **JazzCash** using your own wallet. Approve on your phone. The order page
   should say **Paid with JazzCash** within a few seconds.
3. Repeat with **Easypaisa**.
4. Check both in **Admin → Orders**: Payment column says *Paid*; the order shows the gateway
   reference and each attempt.
5. Find the same references in each merchant portal, and refund the test payments there.
6. Archive the test product.

If a payment fails, **Runtime logs** of the API app show the gateway's response code for each
attempt (`[payment] T2026… -> FAILED (code)`), and so does the order's *Attempts* list in the admin.

---

## Everyday running

| You'll see | Meaning | Do |
|---|---|---|
| **JazzCash · Paid** | Money received | Ship as normal |
| **Unpaid / Payment failed** | Customer hasn't paid yet | Nothing — they can retry for 30 minutes, then it cancels itself |
| **Check payment** (dashboard: *Payments to check*) | The gateway's answer didn't add up, or money arrived for a cancelled order | Look up the reference in the merchant portal, then confirm the order or refund |
| **Not paid** | The 30 minutes passed | Nothing — stock was returned |

**Refunds** are made in the JazzCash / Easypaisa merchant portal. Cancelling a paid order in the
admin returns the stock but does **not** refund the money; the admin reminds you when you cancel.

**Confirming an unpaid wallet order** asks you to double-check first.

---

## Updating the payment server later

Code changes: new `TernTechShop-api.zip` → API web app → **Deployments → Redeploy** → upload.
Changing a key or password: edit the environment variable and redeploy. Environment variables are
kept between deployments.

---

## Developing locally

```bash
npm run emulators                    # terminal 1 (repo root)
cd server && npm run mock-gateways   # terminal 2: fake JazzCash + Easypaisa on :4600
```

Terminal 3 — the payment server against the emulators and mocks:

```powershell
cd server
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:FIREBASE_PROJECT_ID="demo-terntech"; $env:PORT="3100"; $env:ALLOWED_ORIGINS="http://localhost:5173"
$env:JAZZCASH_MERCHANT_ID="MC12345"; $env:JAZZCASH_PASSWORD="secret-pass"; $env:JAZZCASH_INTEGRITY_SALT="TESTSALT123"
$env:JAZZCASH_BASE_URL="http://127.0.0.1:4600"
$env:EASYPAISA_STORE_ID="12345"; $env:EASYPAISA_USERNAME="ep-user"; $env:EASYPAISA_PASSWORD="ep-pass"
$env:EASYPAISA_ACCOUNT_NUMBER="03000000000"; $env:EASYPAISA_BASE_URL="http://127.0.0.1:4600"
npm run dev
```

Then `npm run dev:emulator` with `VITE_PAYMENTS_API_URL=http://127.0.0.1:3100` in
`.env.emulator.local`. The mock decides the outcome from the **last digit of the wallet number**:
`1` approved · `2` declined · `3` slow (confirmed by inquiry) · `4` no answer · `5` wrong amount.

Tests: `cd server && npm test` (needs the emulators running).

---

## Known limits

| Limit | Detail |
|---|---|
| Wallet payments only | No debit/credit cards. Cards would use the gateways' hosted checkout pages — a separate integration |
| Gateway field names | Built to JazzCash Mobile Wallet REST v2.0 and Easypaisa MA REST v4. If your merchant integration guide differs (e.g. a different path), the `*_WALLET_PATH` / `*_INQUIRY_PATH` / `*_BASE_URL` variables can be changed without code changes |
| One server process | Rate limits and in-progress tracking are in memory; fine for one Hostinger app. Running several copies would need shared storage |
| Refunds are manual | Done in each merchant portal |
