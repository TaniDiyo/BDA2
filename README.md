# FraudLens — Phase 6

FraudLens is a JavaScript-only credit-card fraud detection application built with Node.js, Express, and MongoDB. It provides JWT authentication, ADMIN/ANALYST access, configurable and statistical fraud rules, customer risk profiles, analyst alerts, synthetic-data generation, and a vanilla JavaScript dashboard.

## Requirements and setup

- Node.js 18 or newer
- MongoDB running locally or reachable through `MONGO_URI`

1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` to a long, unique random value before exposing the app.
3. Configure `MONGO_URI` if MongoDB is not available at `mongodb://127.0.0.1:27017/fraudlens`.
4. Install and start:

   ```sh
   npm install
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000), create the first account (ADMIN), and sign in. Later registrations receive the ANALYST role.

For development, `npm run dev` starts Node's watch mode. The server requires `JWT_SECRET` and connects to MongoDB before it starts listening. In production, `JWT_SECRET` must be at least 32 characters and `CLIENT_URL` must list the allowed dashboard origins.

## Overview and architecture

FraudLens accepts card transactions using only a four-digit card suffix, scores each transaction using configurable and statistical rules, and supports role-based review of alerts. The protected dashboard includes transaction charts, alert investigation, rules, customer profiles, and model evaluation.

- **Backend:** Node.js 18+, Express 5, Mongoose/MongoDB, JWT, bcryptjs, express-validator, Helmet, CORS, express-rate-limit, and express-mongo-sanitize.
- **Dashboard:** Static HTML, CSS, and vanilla JavaScript served from `public/`; Chart.js is loaded from cdnjs.
- **Architecture:** `src/app.js` configures HTTP middleware and routes; `src/routes/` maps endpoints to `src/controllers/`; controllers call `src/services/`; `src/models/` defines MongoDB schemas and indexes; `src/middleware/` handles authorization, validation, errors, and rate limits. `server.js` connects to MongoDB, seeds rules, and owns process lifecycle.
- **Tests:** Jest, Supertest, and MongoDB Memory Server. Integration tests use an isolated in-memory database.

## Project structure

```text
server.js
src/
  app.js
  config/db.js
  controllers/
  middleware/
  models/
  routes/
  services/
  seed.js
tests/
  unit/
  integration/
public/
  index.html
  alerts.html
  rules.html
  customers.html
  login.html
  style.css
  app.js
  login.js
client/
  .env.example  # API URL example only; no React client/package exists here
```

`npm start` starts the production Node process; `npm run dev` is the development watcher. Copy `.env.example` to `.env` for local work, replace the example JWT secret, and set `MONGO_URI` if needed. Install dependencies with `npm install`. `docker compose up --build` runs the backend with local MongoDB after setting `JWT_SECRET` in `.env`.

## API

Authentication endpoints:

- `POST /api/auth/register` — body: `{ "name", "email", "password" }`; password must contain at least 6 characters. Returns 201 with `{ "token", "user" }`.
- `POST /api/auth/login` — body: `{ "email", "password" }`; returns `{ "token", "user" }`.
- `GET /api/auth/me` — returns the current user as `{ "user": ... }`.
- `GET /api/health` — public liveness/readiness response; returns 200 with a connected database and 503 otherwise.

Protected endpoints require `Authorization: Bearer <token>`:

- `POST /api/transactions` — validates and scores a transaction, then returns the saved document with HTTP 201.
- `GET /api/transactions?page=1&limit=10&status=REVIEW&customerId=CUST-1001` — all filters are optional; returns `{ "data": [], "page": 1, "limit": 10, "total": 0, "totalPages": 0 }`.
- `GET /api/stats` — preserves the transaction totals and adds `openAlerts`, `fraudRate` (percentage), `totalAmountBlocked`, and `transactionsByDay` (seven UTC dates with counts).
- `DELETE /api/transactions/:id` — ADMIN only; returns a success message.
- `GET /api/rules` — returns the seven fraud rules and decision thresholds.
- `PUT /api/rules/:id` — ADMIN only; update `enabled`, positive `threshold`, and/or `points` from 0 to 100.
- `PUT /api/rules/settings/thresholds` — ADMIN only; body `{ "reviewThreshold": 40, "blockThreshold": 70 }`.
- `GET /api/customers/:customerId` — customer risk profile and their latest 10 transactions.
- `GET /api/alerts?alertStatus=OPEN&page=1&limit=10` — paginated alerts; status is optional.
- `GET /api/alerts/:id` — alert, linked transaction, assignee, and populated notes.
- `PUT /api/alerts/:id/status` — body `{ "alertStatus": "INVESTIGATING" }`; terminal states set `resolvedAt`.
- `PUT /api/alerts/:id/assign` — assign the alert to the authenticated user.
- `POST /api/alerts/:id/notes` — body `{ "text": "..." }`.
- `GET /api/evaluation` — ADMIN and ANALYST; evaluates generated transactions against their ground-truth labels and returns the confusion matrix and precision, recall, F1, and accuracy.

`cardLast4` must contain exactly four digits. Full card numbers are not accepted or stored. Amount must be positive, and `country` must be a 2-letter code. The optional `homeCountry` defaults to `IN`.

All `/api` endpoints have a configurable per-IP request limit; login and registration have a stricter per-IP limit. JSON request bodies are capped at 10kb and sanitized against MongoDB operator injection. CORS uses the comma-separated `CLIENT_URL` allowlist. Production errors do not include stack traces or request bodies; HTTP request logs omit URLs, query strings, and request contents. Set `TRUST_PROXY_HOPS=1` only when the production host places one trusted proxy in front of the service; it is `0` for direct local access.

## MongoDB models and rule decisions

On first startup, FraudLens seeds the Rule collection with HIGH_AMOUNT, VERY_HIGH_AMOUNT, AMOUNT_VS_AVERAGE, VELOCITY, FOREIGN_COUNTRY, ODD_HOURS, NEW_DEVICE, ANOMALY_ZSCORE, and UNUSUAL_MERCHANT_CATEGORY, and seeds decision thresholds of REVIEW 40 and BLOCK 70. Rule and decision configuration is cached for up to 60 seconds; admin updates invalidate the cache immediately.

The fraud engine adds the points for every enabled matching rule and caps the score at 100. Very high amount is used instead of the high-amount band when both thresholds match. Amount-vs-average requires at least three previous transactions. Velocity counts the current transaction with matching earlier transactions during the previous 10 minutes. Overnight hours are UTC. A score at or above the configured BLOCK threshold is BLOCKED; otherwise a score at or above REVIEW is REVIEW.

ANOMALY_ZSCORE uses Welford's running count, mean, and M2 to compute the sample standard deviation without rescanning transaction history. It triggers only after five previous transactions, when the amount is more than the configured z-score threshold above the mean, and is skipped when standard deviation is zero. UNUSUAL_MERCHANT_CATEGORY triggers for a previously unseen category after ten previous transactions. Neither rule uses the generated `isFraudulent` label.

Every saved transaction updates its CustomerProfile incrementally and atomically: total and status counts, average and maximum amount, Welford's amount statistics, known devices/countries/categories, last transaction time, and risk level. Transactions assessed as REVIEW or BLOCKED automatically create an OPEN Alert. Alerts can be assigned, annotated, and resolved as confirmed fraud or false positive.

Models include Transaction, User, Rule, Settings, CustomerProfile, and Alert. Password hashes are excluded from user responses.

## Synthetic data, evaluation, and tests

Generate repeatable sample data for 50 synthetic customers (default 1,000 transactions, approximately 5% labelled fraudulent):

```sh
npm run seed
npm run seed -- 250
npm run seed -- 1000 --clear
```

`--clear` removes only previously generated transactions, their alerts, and generated customer profiles. Each generated transaction passes through the same fraud scoring, profile update, and alert workflow as an API transaction. The ground-truth label is stored in `isFraudulent` only for evaluation; API callers cannot set it. Existing rule settings are preserved when defaults are seeded.

Open [http://localhost:3000/evaluation](http://localhost:3000/evaluation) or select Evaluation in the dashboard navigation. The page shows true/false positives and negatives plus precision (share of predicted fraud that is labelled fraud), recall (share of labelled fraud detected), F1 (harmonic mean of precision and recall), and accuracy (share of all predictions correct). REVIEW and BLOCKED count as predicted fraud. The page reports when there is no generated labelled data.

Run automated tests (integration tests use an isolated `mongodb-memory-server`, not the configured database):

```sh
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

For the labelled demo identities and data, set `DEMO_ADMIN_PASSWORD` and `DEMO_ANALYST_PASSWORD` (each at least 12 characters) plus `MONGO_URI`, then run `npm run seed:demo -- 1000`. Existing credentials are not overwritten.

The evaluation page is implemented in the existing static vanilla-JavaScript frontend under `public/`; this project folder does not contain the `/client` React application referenced in the Phase 5 request.

## Production and deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Atlas, Render, and Vercel setup, frontend API URL configuration, troubleshooting, and provider free-tier caveats. Use [DEMO-CHECKLIST.md](./DEMO-CHECKLIST.md) to prepare a five-minute product walkthrough.

## curl examples

Register and capture the JWT:

```sh
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"FraudLens Admin","email":"admin@example.com","password":"change-me"}'
```

Set `TOKEN` to the returned token, then submit a transaction:

```sh
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cardLast4":"4821","customerId":"CUST-1001","amount":120000,"merchant":"Example Store","category":"Retail","country":"US","homeCountry":"IN","deviceId":"DEVICE-1","timestamp":"2026-10-27T02:00:00Z"}'
```

List a page and check stats:

```sh
curl "http://localhost:3000/api/transactions?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/stats -H "Authorization: Bearer $TOKEN"
```

Update a rule as an ADMIN and review its current configuration:

```sh
curl -X PUT http://localhost:3000/api/rules/RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threshold":60000,"points":30,"enabled":true}'
curl http://localhost:3000/api/rules -H "Authorization: Bearer $TOKEN"
```

List alerts and assign one to yourself:

```sh
curl "http://localhost:3000/api/alerts?alertStatus=OPEN&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
curl -X PUT http://localhost:3000/api/alerts/ALERT_ID/assign \
  -H "Authorization: Bearer $TOKEN"
```
