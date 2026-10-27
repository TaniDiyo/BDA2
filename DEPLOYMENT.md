# FraudLens deployment guide

This workspace currently contains the Express backend and a static vanilla-JavaScript dashboard in `public/`. There is no React application under `/client`; Vercel serves the existing dashboard files, and `VITE_API_URL` is used by the static frontend configuration build script.

## 1. Create a MongoDB Atlas database

1. Create a MongoDB Atlas account and a free cluster using the current Atlas instructions.
2. In **Database Access**, create a database user with a strong, unique password. Grant only the permissions needed for the `fraudlens` database.
3. In **Network Access**, allow the backend host's outbound IP addresses. If your backend provider does not offer static outbound IPs, follow its current Atlas connectivity guidance rather than leaving broad access enabled.
4. Choose **Connect → Drivers**, copy the Node.js connection string, replace the password placeholder, and set the database name to `fraudlens`, for example `mongodb+srv://.../fraudlens?retryWrites=true&w=majority`.
5. Keep this URI private; encode special characters in the database password and set it as `MONGO_URI` on the backend provider.

## 2. Deploy the backend to Render

1. Push this repository to GitHub and connect it to Render as a new **Web Service**. The included `render.yaml` can be used as a Blueprint.
2. Use the repository root as the service root. The build command is `npm ci --omit=dev` and the start command is `npm start`.
3. Configure `MONGO_URI` from Atlas, `JWT_SECRET` as a unique random value of at least 32 characters, and `CLIENT_URL` as the exact deployed dashboard origin. For multiple origins, separate them with commas and do not include a wildcard.
4. Keep `NODE_ENV=production`. The rate-limit settings may be adjusted with `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, and `AUTH_RATE_LIMIT_MAX`.
   `TRUST_PROXY_HOPS=1` is configured in `render.yaml` for Render's single proxy hop so per-IP limits see the client address.
5. After deploy, open `https://YOUR-BACKEND/api/health`. A healthy service returns `{"status":"ok","database":"connected"}`.

## 3. Deploy the dashboard to Vercel

1. Import the same GitHub repository into Vercel and set the project root to the repository root.
2. Vercel uses `npm run build:client` and publishes `public/`. Set `VITE_API_URL` to the backend origin, such as `https://YOUR-BACKEND.onrender.com`, with no trailing slash.
3. Deploy the dashboard and copy its production origin (for example `https://YOUR-PROJECT.vercel.app`).
4. Add that exact origin to backend `CLIENT_URL` in Render, then redeploy the backend. The backend rejects browser origins outside the configured list.
5. The included rewrites map `/alerts`, `/rules`, `/customers`, and `/evaluation` to their static HTML pages so refreshes work.

## 4. Seed demo data against Atlas once

Run this from a trusted local shell with the Atlas URI and demo passwords loaded as environment variables. These passwords are required at runtime and are never included in the repository:

```powershell
$env:MONGO_URI = "mongodb+srv://..."
$env:DEMO_ADMIN_PASSWORD = Read-Host "Demo admin password"
$env:DEMO_ANALYST_PASSWORD = Read-Host "Demo analyst password"
npm run seed:demo -- 1000
```

Use unique passwords of at least 12 characters. The seed command creates `admin@fraudlens.com` and `analyst@fraudlens.com` if absent, then generates labelled demo transactions. It does not print passwords. Do not run `--clear` against production unless you deliberately intend to delete generated demo records.

## Troubleshooting

- **CORS errors:** Confirm `CLIENT_URL` exactly matches the deployed dashboard origin (scheme and hostname, no path), use commas for multiple origins, and redeploy after changes. Do not use `*` in production.
- **Cannot connect to MongoDB:** Check the Atlas URI, database user/password encoding, Atlas network access list, and the backend provider's outbound access. Check Render logs for the startup failure without sharing connection credentials.
- **404 on refresh:** Verify the Vercel project uses repository root, `npm run build:client`, and the `public` output directory with the included rewrites.
- **Free-tier backend sleeps:** Some provider free tiers suspend idle services; the first request after inactivity may take about a minute to wake up. This is provider-dependent and can change.

Free-tier quotas, sleep behavior, and pricing change over time. Check the current pricing and limits on MongoDB Atlas, Render, and Vercel before deployment.

## Scope note

The requested React `/client` project is not present in this workspace, so this guide deploys the current static dashboard. The Vercel build writes an API URL config file; it is not a React/Vite bundle build.
