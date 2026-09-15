# Deploy ETL Ops Dashboard (Vercel + Render)

## Architecture

| Part | Host | Folder |
|------|------|--------|
| React UI | [Vercel](https://vercel.com) | `tools/etl-ops-web` |
| FastAPI | [Render free tier](https://render.com) | `tools/etl-ops-api` |

---

## Step 1 — Deploy API on Render (free, ~5 minutes)

1. Push this repo to GitHub (if not already).
2. Open **[dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)** → **New Blueprint Instance**.
3. Connect GitHub → select **`HarshaTammana07/ETL_OPS_DASHBOARD`**.
4. Render reads **`render.yaml`** at repo root and creates **`etl-ops-api`**.
5. Click **Apply** and wait for the build (loads CSV → SQLite on first build).
6. When live, copy the URL, e.g. `https://etl-ops-api-xxxx.onrender.com`.
7. Test: `https://etl-ops-api-xxxx.onrender.com/api/health` → JSON `{ "status": "ok", ... }`.

**Optional env vars** (Render → etl-ops-api → Environment):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Enable AI chat (`CHAT_MODE=agent`) |
| `CHAT_MODE` | `rules` (default, no key) or `agent` |
| `CORS_ORIGIN_REGEX` | Default allows `*.vercel.app` |

Free tier sleeps when idle; first request after sleep may take ~30 seconds.

---

## Step 2 — Connect Vercel frontend to API

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add:

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://etl-ops-api-xxxx.onrender.com/api` |

   Include **`/api`** at the end.

3. **Deployments** → **Redeploy** (required — Vite bakes env at build time).

---

## Step 3 — Verify

- Vercel app loads KPIs (not “Could not load dashboard data”).
- Browser DevTools → Network → requests go to `onrender.com`, not `vercel.app/api`.

---

## Railway (alternative)

1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**.
2. Set **Root Directory** to `tools/etl-ops-api` (uses `railway.toml`).
3. Generate domain → use same `VITE_API_URL` pattern on Vercel.

---

## Local dev (unchanged)

```powershell
# Terminal 1
cd tools/etl-ops-api
py -m uvicorn app.main:app --reload --port 8000

# Terminal 2
cd tools/etl-ops-web
npm run dev
```

Open http://localhost:5173 — no `VITE_API_URL` needed locally.
