# Cloudflare Checkout Setup

Checkout is fail-closed. The storefront will not create an invoice until Cloudflare D1, provider secrets, payout verification, fulfillment readiness, shipping/tax rules, support contact, and HTTPS policy links are all configured.

## Deployment

Use Cloudflare Pages with the repository's Git integration. The API is implemented as Pages Functions in the root `functions/` directory.

1. Connect the repository and branch to a Cloudflare Pages project.
2. Set **Root directory** to the repository root.
3. Leave **Build command** empty (none).
4. Set **Build output directory** to `.` (the repository root). The website serves `index.html` from the root and Pages executes backend endpoints from `functions/`.
5. Create the D1 database and apply the checked-in migration:

   ```powershell
   npx wrangler d1 create foldtech-orders
   npx wrangler d1 execute foldtech-orders --remote --file=migrations/0001_orders.sql
   ```

   In the Pages project settings (**Settings → Functions → D1 database bindings**), add a D1 binding named `DB` and select the `foldtech-orders` database.
6. Configure Preview and Production environments separately:
   - **Preview**: `APP_ENV=test` and `NOWPAYMENTS_API_BASE=https://api-sandbox.nowpayments.io`.
   - **Production**: `APP_ENV=production` and `NOWPAYMENTS_API_BASE=https://api.nowpayments.io`.
   Never place production secrets into Preview.
7. Configure the NOWPayments IPN callback URL in your NOWPayments dashboard to:
   `https://<your-cloudflare-pages-host>/api/payments/nowpayments-ipn`
   Invoices are created with order prices in USD without restricting coin choice, allowing customers to choose among supported cryptocurrencies and networks on NOWPayments' hosted invoice page.
8. Verify setup after deployment by accessing `/api/checkout/config`. It returns `{"enabled":false,...}` until all database bindings, variables, and verification flags are set.

The checkout endpoints are:
- `/api/checkout/config`: Returns checkout availability status and public policy URLs.
- `/api/checkout/create`: Validates inputs, rate limits requests, stores order record, and generates hosted NOWPayments invoice.
- `/api/orders/<order-uuid>`: Returns non-PII order status.
- `/api/payments/nowpayments-ipn`: Verifies HMAC-SHA512 signed callbacks from NOWPayments and updates order status.

## Cloudflare Secrets

Set these through Pages project **Settings → Environment variables**:

- `NOWPAYMENTS_API_KEY`: API key from NOWPayments account.
- `NOWPAYMENTS_IPN_SECRET`: Instant Payment Notification secret key for callback verification.
- `RATE_LIMIT_SECRET`: Random string with at least 32 characters for IP HMAC hashing.

## Cloudflare Variables

- `APP_ENV`: `test` for sandbox or `production` for live.
- `NOWPAYMENTS_API_BASE`: `https://api-sandbox.nowpayments.io` (test) or `https://api.nowpayments.io` (production).
- `NOWPAYMENTS_PAYOUTS_VERIFIED`: Set to `true` only after verified test transactions confirm payouts arrive at intended wallets on the expected networks.
- `FULFILLMENT_VERIFIED`: Set to `true` only after inventory, fulfillment, customer support, and shipping procedures are verified.
- `SHIPPING_TAX_RATES_JSON`: Valid JSON mapping uppercase two-letter country codes to shipping & tax rates:
  ```json
  {
    "US": {
      "shippingCents": 500,
      "taxBasisPoints": 800,
      "taxableShipping": true
    }
  }
  ```
- `STORE_TERMS_URL`: Verified HTTPS URL for store terms.
- `STORE_PRIVACY_URL`: Verified HTTPS URL describing privacy & data handling.
- `SUPPORT_EMAIL`: Monitored customer support email address.

## Pre-Launch Verification Checklist

- Run `npm test` and confirm all automated tests pass.
- Verify D1 migration `migrations/0001_orders.sql` is applied.
- Test preview sandbox invoice generation and callback verification.
- Confirm order statuses transition to `paid` only upon verified `finished` status from NOWPayments.
- Restrict access to Cloudflare D1 dashboard for fulfillment handling.
