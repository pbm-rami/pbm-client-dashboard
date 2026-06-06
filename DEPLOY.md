# PBM Client Dashboard — Deployment Guide

## Local development

```bash
cd PBM_Dashboard
npm install
# Edit .env.local with real values (see template below)
npm run dev
# Open http://localhost:3000
```

---

## Environment variables

Set all of these in **Vercel → Project → Settings → Environment Variables**.

### BigQuery

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `pbm-pl-data-bank` |
| `GCP_SERVICE_ACCOUNT_JSON` | Paste the **entire contents** of the service account key JSON as one line |

To get the service account JSON: GCP Console → IAM & Admin → Service Accounts → `mira-pipeline` → Keys → Add Key → JSON → copy the full file contents.

### NextAuth

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | A random 32-byte base64 string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXTAUTH_URL` | Your Vercel deployment URL, e.g. `https://pbm-dashboard.vercel.app` (no trailing slash). Update this after first deploy if you don't have a custom domain yet. |

### Client registry

| Variable | Value |
|---|---|
| `CLIENTS_JSON` | JSON array — see format below |
| `DASHBOARD_CLIENT_NAME` | `Emile Sakhel` (fallback when no session; keep in sync with CLIENTS_JSON) |

**CLIENTS_JSON format** (paste the raw JSON, no quotes, directly into the Vercel field):
```json
[
  {
    "id": "1",
    "display_name": "Emile Sakhel",
    "email": "emile@pricingbymira.com",
    "password": "PBM-Emile-2026",
    "client_name": "Emile Sakhel"
  }
]
```

> ⚠️ `client_name` must match the `client_name` value in BigQuery **exactly** (case-sensitive).
> Vercel stores env vars encrypted — plain-text passwords are safe here.

**Adding a new client:** add a new object to the array and redeploy (Vercel → Deployments → Redeploy).

---

## Deploy to Vercel via GitHub (recommended)

1. Push `PBM_Dashboard/` to a GitHub repository
2. Vercel dashboard → **New Project** → **Import from GitHub**
3. Set **Root Directory** to `PBM_Dashboard`
4. Add all environment variables from the table above
5. Click **Deploy**
6. Once deployed, copy the URL and update `NEXTAUTH_URL` in Vercel env vars → **Redeploy**

## Deploy via Vercel CLI

```bash
npm install -g vercel
vercel login
cd PBM_Dashboard
vercel --prod
```

---

## Adding a new client (after go-live)

1. Add a new entry to `CLIENTS_JSON` in Vercel env vars
2. Add a matching `CREATE OR REPLACE VIEW` for the client in BigQuery (copy `06b_emile_sakhel_views.sql` as a template if using client-specific views, or confirm the new client's data already flows through `vw_client_performance` and `vw_listing_performance`)
3. Redeploy

---

## Local .env.local template

```
GCP_PROJECT_ID=pbm-pl-data-bank
GCP_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

NEXTAUTH_SECRET=<generate with crypto.randomBytes>
NEXTAUTH_URL=http://localhost:3000

DASHBOARD_CLIENT_NAME=Emile Sakhel
CLIENTS_JSON=[{"id":"1","display_name":"Emile Sakhel","email":"emile@pricingbymira.com","password":"PBM-Emile-2026","client_name":"Emile Sakhel"}]
```
