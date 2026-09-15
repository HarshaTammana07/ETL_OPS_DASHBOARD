# ETL Operations Center — React Frontend

Production React SPA for BHG ETL health monitoring. Reads from the FastAPI backend (`tools/etl-ops-api`).

## Stack

- React 18+ / TypeScript / Vite
- TanStack Query + React Router
- Recharts + Tailwind CSS

## Pages

| Route | Description |
|-------|-------------|
| `/` | Daily KPIs + recent runs |
| `/trends` | 7/30-day charts |
| `/pipelines` | Module overview + BR/SL/GL drill-down |
| `/failures` | Site failures + audit side panel |
| `/data-quality` | DQ issues |
| `/runs` | Run explorer |
| `/chat` | Ops assistant (rule-based, read-only) |

## Run locally

**Terminal 1 — API:**
```powershell
cd tools/etl-ops-api
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — React:**
```powershell
cd tools/etl-ops-web
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to port 8000.

## Data

Local dev uses CSV exports in `DATA/` loaded into SQLite on API startup. No Streamlit — this React app is the UI.
