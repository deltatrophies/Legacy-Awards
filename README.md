# Legacy Awards

Production-oriented React storefront and Node.js API. The API owns authentication, catalog data, quote pricing, inquiries, file uploads, payments, and orders.

## Stack

- React 19 + Vite
- Node.js + Express 5
- MongoDB Atlas + Mongoose
- Cloudinary for artwork and inquiry attachments
- Razorpay order creation, checkout verification, and signed webhooks
- Zod validation, JWT rotation, Helmet, CORS, rate limiting, request IDs, and structured logs

## Local setup

1. Copy `server/.env.example` to `server/.env` and fill in secrets. Never commit `.env`.
2. Install packages with `npm install`.
3. Seed the initial catalog with `npm run seed`.
4. Run both applications with `npm run dev`.

The storefront runs on `http://localhost:5173`; `client/vite.config.js` proxies `/api` to the API on `http://localhost:5000`.

## Commands

```bash
npm run dev          # frontend and API
npm run dev:client   # frontend only
npm run dev:server   # API only
npm run build        # production frontend bundle
npm start            # production API and built frontend
npm run seed         # idempotent catalog and coupon seed
npm test             # automated tests
npm run smoke        # live database, catalog, quote, and Cloudinary checks
```

Create the first admin without saving its password in a file:

```powershell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="a-strong-one-time-password"
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

## Project structure

```text
client/
  public/        static storefront assets
  src/           React components, pages, services, data, and styles
  package.json   frontend-only dependencies and commands
server/
  scripts/       operational smoke checks
  src/common/    shared errors, middleware, and utilities
  src/config/    environment, MongoDB, logging, and providers
  src/database/  catalog seed and controlled admin bootstrap
  src/modules/   auth, products, quotes, inquiries, uploads, payments, orders
  tests/         backend tests
  package.json   backend-only dependencies and commands
package.json     workspace orchestration only
```

## API overview

All business endpoints are under `/api/v1`.

- Auth: register, login, refresh, logout, and current user
- Public catalog plus admin catalog management
- Public quote submission plus staff queue and status management
- Inquiry submission with attachments plus staff management
- Cloudinary artwork uploads
- Razorpay order creation, verification, and webhooks
- Staff order queue and fulfillment updates

Access tokens are short-lived. Refresh tokens are rotated, stored hashed in MongoDB, and sent only as `HttpOnly` cookies. Quote totals and custom-design prices are recomputed by the API; client-supplied prices are never trusted.

## Razorpay activation

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the webhook URL as:

```text
https://your-domain.example/api/v1/payments/webhook
```

For the current Render API, the webhook URL is:

```text
https://legacy-awards-delta-trophies.onrender.com/api/v1/payments/webhook
```

Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, and `payment.refunded`, and enable automatic capture in Razorpay. Payments remain unavailable until the key pair is present. Checkout becomes available only after the customer accepts the final quote and an admin selects online payment. Use Test Mode keys and a Test Mode webhook while validating; replace all three values together for Live Mode.

## Production

Set `NODE_ENV=production`, `COOKIE_SECURE=true`, a precise HTTPS `APP_ORIGIN`, and production secrets in the server environment. Run `npm run build` before `npm start`; the server serves `client/dist` in production. The included multi-stage Dockerfile runs as the unprivileged `node` user.

Rotate any credential shared through chat or another non-secret channel before launch.
