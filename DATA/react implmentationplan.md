# ETL Operations Center — React Application Implementation Plan

**Purpose:** Production-grade React app for daily ETL health, KPIs, drill-down, and a safe chatbot — replacing / extending the Streamlit POC.

**Audience:** Frontend + backend engineers, platform team  
**Status:** Implementation planning  
**Prerequisites (already done):**
- Streamlit POC: `tools/etl-ops-dashboard/` (queries, chatbot intents, sample CSV/SQLite)
- Meta table docs: `BCAppCode/Framework/controlAudittables.txt`
- Streamlit plan: `BCAppCode/Framework/EtlOps/EtlOps_Dashboard_POC_Plan.md`
- Fabric export notebook: `BCAppCode/Framework/EtlOps/nb_export_meta_tables_to_files.py`

---

## 1. Executive summary

Build an **ETL Operations Center** React application that reads from `bhg_bronze.meta.*` (six control/audit tables) via a **read-only API**. The UI must match and exceed the Streamlit POC:

| Capability | Description |
|------------|-------------|
| **Home KPIs** | Runs, success %, failures, running tasks, failed bronze sites |
| **Trends** | 7/30-day success vs failure charts |
| **Pipeline drill-down** | Filter by `ConfigName`, layer (BR/SL/GL), `PipelineRunId` parent run |
| **Site failures** | `SiteCode`, `DataBaseName`, `ErrorMessage`, row counts |
| **Data quality** | Non-PASS `dataquality` rows |
| **Run explorer** | Search `RunId`, `PipelineRunId`, site, date |
| **Chatbot** | Natural language → **predefined parameterized queries only** (no free-form SQL) |

**Source of truth:** Fabric Warehouse SQL endpoint (prod). Local dev: SQLite built from CSV exports (same as Streamlit POC).

---

## 2. BHG ETL domain context (must be reflected in UI)

### 2.1 Legacy → Fabric mental model

| Legacy (C# / Azure SQL) | Fabric |
|-------------------------|--------|
| `BHGTaskRunner.exe` schedules 1–11 | Fabric pipelines + `meta.etlconfig` |
| Per-clinic SAMMS DB (`ctrl.tbl_LocationCons`) | `taskconfig.SiteCode`, `DataBaseName` |
| `tsk.tbl_Tasks` queue | `meta.taskqueue` |
| `tsk.tbl_RowTrax` row counts | `meta.taskaudit` |
| Year-split tables (DartsSrv, Orders) | Bronze/Silver/Gold lakehouse tables |

### 2.2 Layer model (BR / SL / GL)

Each pipeline execution often produces **three layer runs** sharing one `PipelineRunId`:

```text
Parent execution (PipelineRunId)
  ├── BR  (Bronze)  — per-site copies from SAMMS / APIs
  ├── SL  (Silver)  — merge / CDC notebooks
  └── GL  (Gold)    — warehouse / semantic layer
```

UI must show **layer status side-by-side** when user drills into a `PipelineRunId`.

### 2.3 Six meta tables

| Table | Key columns for UI |
|-------|-------------------|
| `meta.etlconfig` | `ConfigId`, `ConfigName`, `TargetName` (BR/SL/GL), `SourceSystem`, `IsActive` |
| `meta.taskconfig` | `TaskConfigId`, `ConfigId`, `Method`, `SiteCode`, `DataBaseName`, `LoadType`, `TargetTable` |
| `meta.pipelinerun` | `RunId`, `PipelineRunId`, `ConfigName`, `Status`, `StartTime`, `EndTime`, `FailedTasks` |
| `meta.taskqueue` | `TaskId`, `RunId`, `SiteCode`, `Status`, `ErrorMessage`, `TargetTable` |
| `meta.taskaudit` | `RowsRead`, `RowsWritten`, `DurationSeconds`, `SiteCode`, `Status` |
| `meta.dataquality` | `ValidationStatus`, `RowCount`, `NullCount`, `DuplicateCount` |

Join keys: see `controlAudittables.txt`.

### 2.4 Pilot pipeline patterns (filters / shortcuts)

| Module | `ConfigName` pattern | Notes |
|--------|---------------------|-------|
| DartsSrv | `SAMMS DartsSrv%` | Per-site bronze; CDC pilot AHK/B12B |
| Dose | `SAMMS Dose%` | High volume |
| Notes | `SAMMS%Note%` | 3parnote / claimnote |
| Forms | `SAMMS Form%` | FormQuestionAnswers |
| P1 Reference | `P1 Reference%` | Multi-method |
| P1 Finance | `P1 Finance%` | Silver notebooks |
| PPA | `PPA%` | |
| Inventory | `%INV%` or `Inventory%` | Many sites per run |

---

## 3. Recommended architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  React SPA (TypeScript)                                           │
│  tools/etl-ops-web/                                               │
│  - Pages, filters, charts, chat UI                                │
│  - MSAL (Entra ID) auth                                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS / JSON
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  API layer (choose one)                                           │
│  Option A: FastAPI (Python) — reuse tools/etl-ops-dashboard/queries │
│  Option B: Node.js + mssql / tedious → Fabric SQL endpoint        │
│  tools/etl-ops-api/                                               │
│  - Read-only endpoints, parameterized SQL only                    │
│  - Chat intent router → same queries as Streamlit                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌─────────────────────┐              ┌─────────────────────┐
│ Fabric Warehouse    │              │ SQLite (local dev)   │
│ bhg_bronze.meta.*   │              │ data/sample.db       │
│ + vw_etl_* views    │              │ from CSV exports     │
└─────────────────────┘              └─────────────────────┘
```

### 3.1 Why split frontend / API

| Concern | Reason |
|---------|--------|
| **Security** | Fabric connection string + SQL never in browser |
| **Chatbot safety** | Server maps intents → whitelisted queries only |
| **Reuse** | Port `queries.py` from Streamlit POC with minimal change |
| **Auth** | API validates Entra token; React uses MSAL |

### 3.2 Suggested tech stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18+, TypeScript, Vite |
| **UI kit** | shadcn/ui + Tailwind **or** MUI |
| **Charts** | Recharts or Apache ECharts |
| **Tables** | TanStack Table (sort, filter, paginate) |
| **Data fetching** | TanStack Query (React Query) |
| **Routing** | React Router v6 |
| **Auth** | `@azure/msal-react` |
| **API** | FastAPI (recommended) or ASP.NET Core |
| **SQL (prod)** | Fabric Warehouse endpoint via `pyodbc` / `aioodbc` |
| **SQL (dev)** | SQLite (existing `db.py`) |

---

## 4. Repository structure

```text
BCAppCode/
  Framework/EtlOps/
    EtlOps_Dashboard_POC_Plan.md              # Streamlit POC plan
    EtlOps_React_Application_Implementation_Plan.md  # this file
    etl_ops_views.sql                         # Fabric reporting views
    nb_export_meta_tables_to_files.py
    nb_etl_ops_daily_health_check.py          # Teams alerts (future)

tools/
  etl-ops-dashboard/                          # Streamlit POC (reference)
    queries.py                                  # ← port to API
    chatbot.py                                  # ← port to API
    db.py

  etl-ops-api/                                # NEW — backend
    app/
      main.py
      config.py
      db/
        fabric.py
        sqlite.py
      routes/
        kpis.py
        pipelines.py
        failures.py
        dataquality.py
        runs.py
        chat.py
      services/
        queries.py                              # copied/adapted from Streamlit
        chatbot.py
      models/
        filters.py                              # Pydantic request models
    requirements.txt
    README.md

  etl-ops-web/                                # NEW — React frontend
    src/
      api/                                      # typed API client
      components/
        layout/
        kpis/
        charts/
        tables/
        filters/
        chat/
      pages/
        HomePage.tsx
        TrendPage.tsx
        PipelinesPage.tsx
        SiteFailuresPage.tsx
        DataQualityPage.tsx
        RunExplorerPage.tsx
        ChatPage.tsx
      hooks/
      types/
      auth/
    package.json
    vite.config.ts
    README.md
```

**Note:** Keep React app in `tools/` next to Streamlit POC until prod; extract to own repo later if needed.

---

## 5. Global filters (apply across pages)

These filters live in a **persistent shell** (header or sidebar) and sync to URL query params.

| Filter | Type | API param | Source column |
|--------|------|-----------|---------------|
| **Reference date** | date picker | `refDate` | `pipelinerun.StartTime` |
| **Lookback days** | 1–30 slider | `lookbackDays` | date window |
| **Pipeline** | searchable dropdown | `configName` | `pipelinerun.ConfigName` / `etlconfig` |
| **Layer** | BR / SL / GL / All | `targetName` | `pipelinerun.TargetName` |
| **Source system** | multi-select | `sourceSystem` | `etlconfig.SourceSystem` (SAMMS, Verity, etc.) |
| **Site code** | text / autocomplete | `siteCode` | `taskqueue.SiteCode`, `taskaudit.SiteCode` |
| **Status** | SUCCESS / FAILED / RUNNING | `status` | `pipelinerun.Status`, `taskqueue.Status` |
| **Method** | text | `method` | `taskconfig.Method` (DartsSrv, SaveDose, etc.) |
| **Active only** | toggle | `isActive` | `etlconfig.IsActive`, `taskconfig.IsActive` |

### 5.1 URL state example

```text
/home?refDate=2026-09-08&lookbackDays=7&configName=SAMMS+DartsSrv+Bronze+Pipeline&targetName=BR
```

### 5.2 Default reference date

If `refDate` omitted: use **max(`pipelinerun.StartTime`)** in dataset (not calendar today) — historical exports behave like Streamlit POC.

---

## 6. Pages and KPIs (full spec)

### 6.1 Home — Daily health

**Route:** `/`

**KPI cards (top row):**

| KPI | API endpoint | SQL logic (summary) |
|-----|--------------|---------------------|
| Pipeline runs | `GET /api/kpis/daily` | `COUNT(*)` from `pipelinerun` where `date(StartTime) = refDate` |
| Success % | same | `SUCCESS / total * 100` |
| Failed runs | same | `Status = 'FAILED'` |
| Running now | `GET /api/kpis/running` | `taskqueue.Status = 'RUNNING'` |
| Failed bronze sites | same daily KPI | `COUNT(DISTINCT SiteCode)` from failed `taskqueue` on refDate |

**Below KPIs:**

- Table: recent pipeline runs on `refDate` (sortable)
- Optional alert banner if `failed_runs > 0`

**Reference implementation:** `tools/etl-ops-dashboard/queries.py` → `today_kpis()`, `recent_pipeline_runs()`

---

### 6.2 Trends — 7 / 30 day

**Route:** `/trends`

**Charts:**

1. **Stacked bar** — per day: `success_runs` vs `failed_runs`
2. **Line** — success rate % by day
3. **Horizontal bar** — top 10 failing `ConfigName` in lookback window

**Filters:** `refDate`, `lookbackDays`, optional `sourceSystem`

**API:**

- `GET /api/trends/daily?refDate=&lookbackDays=`
- `GET /api/trends/top-failures?refDate=&lookbackDays=&limit=10`

---

### 6.3 Pipelines — module catalog + layer drill-down

**Route:** `/pipelines`

**Section A — Module overview table**

| Column | Source |
|--------|--------|
| ConfigName | `etlconfig` |
| TargetName / layers | BR, SL, GL rows |
| SourceSystem | `etlconfig.SourceSystem` |
| IsActive | `etlconfig.IsActive` |
| Runs in window | join `pipelinerun` |
| Failed runs | aggregate |
| Last run | `MAX(StartTime)` |

**Section B — Filtered run list**

Filters: `configName`, `targetName`, date window.

**Section C — Parent run detail (drawer or `/pipelines/run/:pipelineRunId`)**

Show BR → SL → GL rows for one `PipelineRunId`:

| Layer | Status | Start | End | SuccessTasks | FailedTasks | Duration |

**API:**

- `GET /api/pipelines/overview`
- `GET /api/pipelines/runs?...`
- `GET /api/pipelines/:pipelineRunId/layers`

---

### 6.4 Site failures

**Route:** `/failures`

**Table columns:**

| Column | Source |
|--------|--------|
| StartTime | `taskqueue` |
| ConfigName | join `pipelinerun` |
| SiteCode | `taskqueue` |
| DataBaseName | `taskqueue` |
| SiteName | `taskqueue` |
| TaskName | `taskqueue` |
| TargetTable | `taskqueue` |
| ErrorMessage | truncated 500 chars |
| PipelineRunId | link to run explorer |

**Filters:** `configName`, `siteCode`, `lookbackDays`, `method` (via `taskconfig` join if needed)

**Drill-down:** click site → side panel with `taskaudit` history (`site_audit_summary`)

**API:** `GET /api/failures/tasks?...`, `GET /api/failures/sites/:siteCode/audit`

---

### 6.5 Data quality

**Route:** `/data-quality`

**Table:** `dataquality` where `ValidationStatus` NOT IN (`PASS`, `SUCCESS`, empty)

Columns: `CreatedAt`, `TableName`, `RowCount`, `NullCount`, `DuplicateCount`, `ValidationStatus`, `ConfigName`, `TargetName`

**Filters:** `refDate`, `lookbackDays` (default 30), `configName`

**API:** `GET /api/data-quality/issues?...`

---

### 6.6 Run explorer

**Route:** `/runs` or `/runs/:id`

**Search inputs:**

- `RunId` or `PipelineRunId` (exact)
- `siteCode` (optional)
- `refDate` (optional checkbox)

**Results:** unified rows from `pipelinerun`, `taskqueue`, `taskaudit`

**Detail:** layer breakdown for `PipelineRunId`

**API:** `GET /api/runs/search?runId=&siteCode=&refDate=`

---

### 6.7 Chat — Ops assistant

**Route:** `/chat`

**UX:**

- Chat thread UI (user message + assistant reply)
- **Suggested prompts** chips (click to send)
- Reply = short summary + optional data table + "View in Failures" deep link
- Show which **intent** was matched (debug toggle for engineers)
- Optional "Show query name" for transparency (not raw SQL in v1)

**v1:** Rule-based intent router (port `chatbot.py`)  
**v2:** Azure OpenAI with function calling → same API endpoints only

---

## 7. API contract (REST)

All endpoints: `GET` only, read-only, accept global filters as query params.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | `{ status, dataBounds }` |
| GET | `/api/kpis/daily` | `{ totalRuns, successPct, failedRuns, runningRuns, failedSiteCount }` |
| GET | `/api/kpis/running` | `{ tasks: [...] }` |
| GET | `/api/trends/daily` | `{ points: [{ runDate, successRuns, failedRuns }] }` |
| GET | `/api/trends/top-failures` | `{ items: [...] }` |
| GET | `/api/pipelines/overview` | `{ pipelines: [...] }` |
| GET | `/api/pipelines/runs` | `{ runs: [...] }` |
| GET | `/api/pipelines/{pipelineRunId}/layers` | `{ layers: [...] }` |
| GET | `/api/failures/tasks` | `{ failures: [...] }` |
| GET | `/api/failures/sites/{siteCode}/audit` | `{ audits: [...] }` |
| GET | `/api/data-quality/issues` | `{ issues: [...] }` |
| GET | `/api/runs/search` | `{ results: [...] }` |
| POST | `/api/chat` | `{ summary, data?, intent, deepLink? }` body: `{ question, refDate, lookbackDays }` |

### 7.1 Pydantic filter model (API)

```python
class GlobalFilters(BaseModel):
    ref_date: date
    lookback_days: int = Field(7, ge=1, le=90)
    config_name: str | None = None
    target_name: Literal["BR", "SL", "GL"] | None = None
    site_code: str | None = None
    source_system: str | None = None
    method: str | None = None
    status: str | None = None
```

---

## 8. Chatbot — intent catalog and pre-queries

**Security rule:** The chat endpoint NEVER executes user-supplied SQL. It only:

1. Classifies intent (rules v1, LLM v2)
2. Extracts slots (`siteCode`, `module`, `time range`)
3. Calls an internal function that runs a **whitelisted** query with bound parameters

### 8.1 Intent definitions

| Intent ID | Example user phrases | Slots | Backend function | Deep link |
|-----------|---------------------|-------|------------------|-----------|
| `failures_today` | "what failed today", "any errors now" | `refDate` | `failed_tasks(lookback=1)` + `today_kpis` | `/failures?refDate=` |
| `failures_week` | "failures this week", "last 7 days errors" | `lookbackDays` | `failed_tasks` + `top_failing_pipelines` | `/trends` |
| `kpi_summary` | "health summary", "how are we doing", "KPIs" | `refDate` | `today_kpis` | `/` |
| `running_tasks` | "what's still running", "in progress pipelines" | — | `running_tasks` | `/` |
| `site_status` | "did site AHK succeed", "status for site B12B" | `siteCode` | `site_audit_summary` | `/failures?siteCode=` |
| `module_failures_darts` | "darts failures", "DartsSrv errors" | `lookbackDays` | `failed_tasks` + filter ConfigName LIKE `%Darts%` | `/failures?configName=` |
| `module_failures_dose` | "dose failures" | `lookbackDays` | filter `%Dose%` | `/failures` |
| `module_failures_notes` | "notes failures", "3p note errors" | `lookbackDays` | filter `%Note%` | `/failures` |
| `module_failures_forms` | "forms failures", "form QA" | `lookbackDays` | filter `%Form%` | `/failures` |
| `module_failures_finance` | "P1 finance failures" | `lookbackDays` | filter `%Finance%` | `/failures` |
| `dq_issues` | "data quality problems", "DQ failures" | `lookbackDays` | `data_quality_issues` | `/data-quality` |
| `silver_row_counts` | "row counts for last darts silver" | `module` | latest SL `taskaudit` for module | `/pipelines` |
| `pipeline_status` | "did Darts bronze run yesterday" | `configName`, `refDate` | `recent_pipeline_runs` | `/pipelines` |
| `help` | "help", "what can you ask" | — | static response | — |

### 8.2 Suggested prompt chips (UI)

```text
What failed today?
Failures this week
Which pipelines are still running?
Did site AHK run successfully?
Darts failures this week
Data quality issues
Show today's KPI summary
```

### 8.3 Chat API request / response

**Request:**

```json
{
  "question": "Did site AHK run successfully?",
  "refDate": "2026-09-08",
  "lookbackDays": 7
}
```

**Response:**

```json
{
  "intent": "site_status",
  "summary": "Latest audit for AHK: DartsSrv Bronze → SUCCESS at 2026-09-08T06:12:00Z (1,240 rows written).",
  "columns": ["StartTime", "TaskName", "Status", "RowsWritten"],
  "rows": [ ... ],
  "deepLink": "/failures?siteCode=AHK"
}
```

### 8.4 v2 — Azure OpenAI system prompt (outline)

```text
You are the BHG ETL Operations assistant. You may ONLY answer using data returned by these tools:
get_daily_kpis, get_failures, get_running_tasks, get_site_audit, get_dq_issues, get_pipeline_runs.
Never invent run counts or site names. If no tool applies, suggest a canned question.
BHG pipelines use Bronze (BR), Silver (SL), Gold (GL) layers. SAMMS clinics are identified by SiteCode (e.g. AHK, B12B).
```

Tools map 1:1 to REST endpoints above.

---

## 9. Fabric SQL views (deploy before prod API)

Create in `BCAppCode/Framework/EtlOps/etl_ops_views.sql`:

| View | Used by |
|------|---------|
| `meta.vw_etl_failures_7d` | failures page, chat |
| `meta.vw_etl_daily_kpi` | home, trends |
| `meta.vw_etl_run_summary` | parent run grouping |
| `meta.vw_etl_site_health` | site failure rate |
| `meta.vw_etl_dq_issues` | data quality page |

API can query views in prod and base tables in dev — keep column names identical in view definitions.

---

## 10. Authentication and deployment

### 10.1 Auth (Entra ID)

| Environment | Auth |
|-------------|------|
| Local dev | Optional auth bypass flag `AUTH_DISABLED=true` |
| Dev / UAT | Entra ID app registration, redirect to `etl-ops-web` |
| Prod | Same + API validates JWT (`aud`, `iss`) |

Roles (future):

- `ETL.Ops.Reader` — view dashboard
- `ETL.Ops.Admin` — view + trigger exports / alerts

### 10.2 Hosting options

| Component | Azure service |
|-----------|---------------|
| React SPA | Azure Static Web Apps **or** App Service static |
| API | Azure App Service (Linux, Python 3.11) |
| Secrets | Key Vault — Fabric SQL connection string |

### 10.3 CI/CD

```text
PR → lint + test (API unit tests, React vitest)
main → deploy API to App Service, SPA to Static Web Apps
```

---

## 11. Implementation phases

### Phase 1 — API + data layer (Week 1)

- [ ] Create `tools/etl-ops-api/` — FastAPI scaffold
- [ ] Port `queries.py` and `chatbot.py` from Streamlit POC
- [ ] SQLite dev mode (reuse `db.py` logic)
- [ ] Implement all `GET` endpoints + `POST /api/chat`
- [ ] OpenAPI docs at `/docs` for frontend team
- [ ] Unit tests for KPI counts against `sample.db`

### Phase 2 — React shell + Home + Trends (Week 2)

- [ ] Vite + TypeScript + router + layout
- [ ] Global filter bar + URL sync
- [ ] Home KPI cards + runs table
- [ ] Trend charts (Recharts)
- [ ] TanStack Query hooks for API

### Phase 3 — Drill-down pages (Week 3)

- [ ] Pipelines overview + layer drill-down drawer
- [ ] Site failures table + site audit side panel
- [ ] Data quality page
- [ ] Run explorer

### Phase 4 — Chat + polish (Week 4)

- [ ] Chat page with prompt chips
- [ ] Intent debug mode
- [ ] Deep links from chat to pages
- [ ] Loading / empty / error states
- [ ] Responsive layout

### Phase 5 — Fabric prod + auth (Week 5)

- [ ] Deploy `etl_ops_views.sql` to Fabric
- [ ] Wire API to Fabric SQL endpoint (AAD auth)
- [ ] Entra ID in React
- [ ] Deploy to Azure (dev environment)

### Phase 6 — Alerts + v2 chat (Week 6+)

- [ ] `nb_etl_ops_daily_health_check` + Teams (from original POC plan)
- [ ] Optional Azure OpenAI for chat v2
- [ ] SLA badges on Home (red/yellow/green)

---

## 12. UI / UX guidelines

| Pattern | Guidance |
|---------|----------|
| Status badges | SUCCESS=green, FAILED=red, RUNNING=blue, SKIPPED=gray |
| Layer chips | BR=bronze, SL=silver, GL=gold color coding |
| Error messages | Truncate in table; expand on row click |
| Large tables | Server-side pagination (`limit`/`offset` on API) |
| SAMMS site row | Always show `SiteCode` + `DataBaseName` together |
| Empty state | "No runs on {refDate} — try another date" (not blank screen) |

---

## 13. Testing strategy

| Level | What to test |
|-------|--------------|
| API unit | Each query function vs known `sample.db` row counts |
| API integration | Filter combinations return expected subsets |
| Chat | 15 canned questions → correct `intent` + non-empty summary |
| E2E (Playwright) | Home loads KPIs; filter changes URL; drill-down opens drawer |
| UAT | Compare React KPIs to manual SQL on Fabric for 3 pilot pipelines |

**Sign-off criteria (from Streamlit POC):**

- [ ] 6 meta tables represented
- [ ] 7-day failure list matches manual SQL
- [ ] Darts, Dose, P1 Reference pipelines filter correctly
- [ ] Chatbot answers 10+ canned questions correctly
- [ ] Entra login works in dev

---

## 14. Master build prompt (copy-paste for AI or new dev)

Use this prompt when starting implementation in a new chat or onboarding a developer:

---

### PROMPT START

```text
Build the BHG ETL Operations Center as a production React + API application.

## Context
BHG migrated ETL from C# BHGTaskRunner to Microsoft Fabric. Pipeline health is stored in six lakehouse tables under bhg_bronze.meta:
- etlconfig (pipeline definitions, ConfigId, ConfigName, TargetName = BR/SL/GL)
- taskconfig (per-site tasks: SiteCode, DataBaseName, Method, LoadType)
- pipelinerun (layer runs: RunId, PipelineRunId, Status, StartTime, EndTime)
- taskqueue (task execution: SiteCode, ErrorMessage, Status)
- taskaudit (row counts: RowsRead, RowsWritten, DurationSeconds)
- dataquality (ValidationStatus, RowCount, NullCount, DuplicateCount)

Join: etlconfig.ConfigId → pipelinerun.ConfigId → taskqueue.RunId → taskaudit.TaskId.
Parent runs group by PipelineRunId (BR + SL + GL layers).

Reference implementation exists in:
- tools/etl-ops-dashboard/queries.py (all SQL)
- tools/etl-ops-dashboard/chatbot.py (intent router)
- BCAppCode/Framework/EtlOps/EtlOps_React_Application_Implementation_Plan.md (full spec)

## Deliverables

### Backend (tools/etl-ops-api/)
- FastAPI, read-only, parameterized SQL only
- Dev: SQLite from CSV (port db.py)
- Prod: Fabric Warehouse SQL endpoint
- Endpoints: /api/health, /api/kpis/daily, /api/trends/*, /api/pipelines/*, /api/failures/*, /api/data-quality/issues, /api/runs/search, POST /api/chat
- Port all functions from queries.py without changing SQL semantics
- Chat: whitelist intents from chatbot.py; never execute user SQL

### Frontend (tools/etl-ops-web/)
- React 18 + TypeScript + Vite + TanStack Query + React Router
- Pages: Home (KPIs), Trends (7-day charts), Pipelines (overview + BR/SL/GL drill-down), Site Failures, Data Quality, Run Explorer, Chat
- Global filters in shell: refDate, lookbackDays, configName, targetName (BR/SL/GL), siteCode, sourceSystem — sync to URL query params
- Default refDate = max StartTime in data (not calendar today)
- Chat page: prompt chips + thread UI; show summary + table + deep link

### KPIs (Home)
- Pipeline runs, success %, failed runs, running tasks, failed bronze site count for refDate

### Charts (Trends)
- Daily success vs failed bar chart
- Top 10 failing ConfigName

### Tables
- TanStack Table with sort, pagination
- Truncate ErrorMessage with expand
- Status badges: SUCCESS/FAILED/RUNNING

### Chat intents (minimum)
- failures_today, failures_week, kpi_summary, running_tasks, site_status (extract SiteCode),
  module_failures_darts/dose/notes/forms/finance, dq_issues, help

### Auth
- MSAL Entra ID for React; API validates JWT
- AUTH_DISABLED=true for local dev

### Do NOT
- Put SQL connection strings in frontend
- Allow free-form SQL from chat
- Commit CSV data or sample.db to git

Match BHG naming: SiteCode, DataBaseName, ConfigName, PipelineRunId, TargetName (BR/SL/GL).
Pilot pipelines: SAMMS DartsSrv%, SAMMS Dose%, P1 Reference%, SAMMS Form%, P1 Finance%.
```

### PROMPT END

---

## 15. Migration from Streamlit POC

| Streamlit | React equivalent |
|-----------|------------------|
| `app.py` pages | React Router routes |
| Sidebar filters | `GlobalFilterBar` component |
| `st.metric` | `KpiCard` component |
| `st.bar_chart` | Recharts `BarChart` |
| `st.dataframe` | `DataTable` (TanStack) |
| `chatbot.py` | `POST /api/chat` + `ChatPage` |
| `load_data.py` | API startup / admin endpoint `POST /api/admin/reload` (dev only) |

Keep Streamlit app for quick local validation until React reaches feature parity.

---

## 16. Open questions (resolve in kickoff)

| # | Question | Default if no answer |
|---|----------|----------------------|
| 1 | FastAPI vs ASP.NET API? | FastAPI (reuse Python queries) |
| 2 | shadcn vs MUI? | shadcn + Tailwind |
| 3 | Separate repo for `etl-ops-web`? | No — stay under `tools/` in BCAppCode |
| 4 | Fabric SQL auth method? | AAD service principal |
| 5 | Pagination default page size? | 50 rows |
| 6 | Chat v2 OpenAI in scope for v1? | No — rule-based only |

---

## 17. Document history

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-09-08 | Platform / DE | React implementation plan + master build prompt |
