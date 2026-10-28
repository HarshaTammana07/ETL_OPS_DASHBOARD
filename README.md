# ETL Operations Center (BHG Medallion Monitoring)

A unified, real-time operational monitoring dashboard and incident triage center for BHG (Behavioral Health Group) data engineering. Tracks pipeline runs, task audits, site-level clinic ingestion failures, and data quality across Bronze, Silver, and Gold Medallion layers.

Built with a **FastAPI** backend and a high-density **React (Vite + Tailwind)** frontend.

---

## 🏗️ Architecture & Live Data Flow

```
┌────────────────────────────────────────────────────────┐
│            Microsoft Fabric Lakehouse                  │
│       bhg_bronze (SQL Analytics Endpoint)              │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │  ODBC Driver 18 + Azure Entra ID Token
                           ▼
┌────────────────────────────────────────────────────────┐
│              tools/etl-ops-api (FastAPI)               │
│                                                        │
│  • fabric_sync.py: 20s delta sync loop                 │
│  • TokenManager: az account get-access-token           │
│  • notifications.py: Teams webhook dual-write          │
│  • SQLite Cache: pipelinerun, taskaudit, taskqueue     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │  JSON REST API (Port 8000)
                           ▼
┌────────────────────────────────────────────────────────┐
│              tools/etl-ops-web (React + Vite)          │
│                                                        │
│  • Port 5180 (Proxies /api → Port 8000)                │
│  • Real-time CST timestamps & table pagination         │
│  • 1-Click Incident Copying & Traceback Drawers        │
│  • Deep links into Microsoft Fabric Monitoring Hub     │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ How We Connect to Live Microsoft Fabric (In Detail)

The dashboard supports both offline sample development and **live 24/7 synchronization directly from the Microsoft Fabric Lakehouse**:

### 1. Azure Entra ID Authentication (`FabricTokenManager`)
- Rather than storing static database passwords, the backend dynamically requests a scoped Azure Entra ID token using the Microsoft Azure CLI:
  ```powershell
  az account get-access-token --resource https://database.windows.net
  ```
- **Token Caching**: `FabricTokenManager` in `fabric_sync.py` caches the encoded UTF-16-LE binary token structure in memory and automatically refreshes it 5 minutes before expiry to eliminate latency on repeated requests.

### 2. ODBC Connection to Fabric SQL Analytics Endpoint
- Connects using `ODBC Driver 18 for SQL Server` directly to the Fabric Lakehouse endpoint:
  ```python
  Server = "ziupvjpf2lfe3ey7dnmuxchh44-7n7qtrmow4oujflvvav2yi6kza.datawarehouse.fabric.microsoft.com"
  Database = "bhg_bronze"
  ```
- Passes the acquired Entra ID token directly to the ODBC connection attributes (`SQL_COPT_SS_ACCESS_TOKEN`, attribute `1256`), enabling enterprise-grade authentication with zero hardcoded credentials.

### 3. Background Delta Sync Worker
- **Polling Loop**: Runs every 20 seconds in the background (`run_periodic_sync_loop`).
- **Rolling Lookback**: Pulls a rolling 3-day window of delta updates for active runs and a 14-day window on startup.
- **Clean Upserts**: Uses atomic delete-and-insert by `RunId` to keep local SQLite tables (`pipelinerun`, `taskaudit`, `taskqueue`, `dataquality`) in sync with Fabric without duplicate entries.
- **Auto-Seeding Alerts**: Every time delta sync detects new failed pipeline runs or task errors, it automatically creates incident records in the `notifications` table so alerts stay live without manual intervention.
- **Status & Control Endpoints**:
  - `GET /api/sync/status` — live status, last sync timestamp, duration, and row counts.
  - `POST /api/sync/trigger` — trigger an immediate on-demand synchronization.

### 4. Microsoft Teams Webhook Dual-Write (Optional Push Feed)
- In addition to pull-based delta sync, the backend exposes:
  ```http
  POST /api/notifications/ingest
  ```
- If a Fabric notebook dual-writes failure cards to this endpoint (the same JSON payload sent to Teams alert channels), it stores them instantly alongside audit records with source tag `teams_webhook`.

### 5. Graceful Cloud Fallback
- In hosted cloud environments without local Azure CLI (e.g. Render Free Tier), `pyodbc` is handled safely and `FABRIC_SYNC_ENABLED=false` allows the API to serve the bundled SQLite snapshot smoothly without crashing.

---

## 🖥️ Application Features & Page Tour

| Page | Route | Key Capabilities |
| :--- | :--- | :--- |
| **Home** | `/` | Executive health dashboard, daily KPIs (Total Runs, Success Rate %, Failure count), Medallion breakdown (Bronze / Silver / Gold), and recent runs grouped by pipeline. |
| **Alerts** | `/alerts` | High-density real-time incident feed, severity pills, layer tabs (`All`, `BR`, `SL`, `GL`), stacked CST timestamps, 1-click `[Copy Incident]` for Slack/Teams, and expandable error tracebacks. |
| **Trends** | `/trends` | Reliability % over time, top recurring failure modes, and multi-day trend graphs. Scope by pipeline run or layer. |
| **Pipelines** | `/pipelines` | Module catalog across Medallion layers. Inspect active configurations, schedules, and source/target table mappings. |
| **Site Failures** | `/failures` | Dedicated clinic site triage for 116+ BHG sites (e.g. AHK, BMA). Drill down into site-specific task errors, database names, and stack traces. |
| **Data Quality** | `/data-quality` | Validation checks and test suites. Surfaces non-PASS validation records and schema discrepancies. |
| **Run Explorer** | `/runs` | Searchable audit explorer. Filter and paginate by `PipelineRunId`, `RunId`, site code, date range, or status. |
| **AI Chat** | `/chat` | Conversational Ops Assistant. Ask natural questions (*"Why did site AHK fail today?"*, *"Show Gold layer health"*). Backed by Google Gemini or OpenRouter with read-only tool calling. |

---

## 🔗 Microsoft Fabric Deep Links

Every run card and table row includes an **Open in Fabric** action button:
- **Direct Pipeline Run Link**: If the pipeline is mapped in `DATA/fabric_pipeline_map.json`, clicking the link deep-links directly to the exact pipeline execution canvas:
  ```
  https://app.fabric.microsoft.com/workloads/data-pipeline/artifactAuthor/workspaces/{workspaceId}/pipelines/{artifactId}/{runId}?experience=fabric-developer
  ```
- **Monitoring Hub Fallback**: If a pipeline GUID is not yet mapped, it automatically redirects the user to the **Microsoft Fabric Monitoring Hub** for the workspace (`.../monitoringhub?experience=fabric-developer`) with the run ID ready for inspection.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 18+
- *(Optional for live Fabric sync)* Azure CLI installed and signed in via `az login`

### 1. Start the FastAPI Backend
```powershell
cd tools/etl-ops-api
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```
- API will be live at: **http://127.0.0.1:8000**
- Interactive Swagger docs: **http://127.0.0.1:8000/docs**

### 2. Start the React Frontend
```powershell
# In a new terminal
cd tools/etl-ops-web
npm install
npm run dev
```
- Open **http://localhost:5180** in your browser.
- Vite automatically proxies `/api/*` requests to your local FastAPI backend on port 8000.

---

## 🤖 AI Ops Chat Setup (Gemini / OpenRouter)

The chat assistant in `tools/etl-ops-api` supports two modes:
1. **Agent Mode (LLM + Tools)**: The model answers questions by calling read-only tools against your database.
2. **Rules Mode**: Keyword-based router that works offline without any API keys.

To configure Gemini (default):
```powershell
cd tools/etl-ops-api
# In your .env file:
GEMINI_API_KEY=your_gemini_api_key
CHAT_MODE=agent
CHAT_PROVIDER=gemini
GEMINI_MODEL=gemini-3.6-flash
```

To configure OpenRouter:
```powershell
# In your .env file:
OPENROUTER_API_KEY=your_openrouter_key
CHAT_MODE=agent
CHAT_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-4o-mini
```

---

## 🌐 Production Deployment

The project is production-ready for deployment with:
- **Frontend**: [Vercel](https://vercel.com) (configured via `tools/etl-ops-web/vercel.json`)
- **Backend**: [Render](https://render.com) (blueprint configured via root `render.yaml`)

For step-by-step instructions on setting environment variables (`VITE_API_URL`) and deploying, see **[DEPLOY.md](file:///c:/Users/tsaty/Desktop/ETL_OPS_DAHBOARD/DEPLOY.md)**.
