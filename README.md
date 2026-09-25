# ETL Operations Center

React dashboard + FastAPI backend for BHG Fabric ETL health monitoring.

**No Streamlit** — the UI is a React SPA in `tools/etl-ops-web/`.

## Architecture

```
DATA/*.csv  →  FastAPI (tools/etl-ops-api)  →  React (tools/etl-ops-web)
                     SQLite (local dev)              Port 5173
                     Port 8000
```

## Quick start
 
```powershell
# API
cd tools/etl-ops-api
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000

# React (new terminal)
cd tools/etl-ops-web
npm install
npm run dev
```

Open **http://localhost:5173**

## AI Chat (v2 — OpenRouter)

The Chat page supports two modes:

| Mode | When |
|------|------|
| **v2 agent** | `OPENROUTER_API_KEY` set in `tools/etl-ops-api/.env` |
| **v1 rules** | No key, or `CHAT_MODE=rules` |

Setup:

```powershell
cd tools/etl-ops-api
copy .env.example .env
# Edit .env — paste your OpenRouter API key
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

The agent calls the same read-only `queries.py` functions as the dashboard (sample CSV/SQLite for now). It never executes user-supplied SQL.

Recommended models on OpenRouter: `openai/gpt-4o-mini` (default), `anthropic/claude-3.5-haiku`, `google/gemini-2.0-flash-001`.

## Open in Fabric (deep links)

Run rows include a **View run / Open in Fabric** link when:

1. `PipelineRunId` is a Fabric UUID (not legacy numeric ids)
2. The pipeline is mapped in `DATA/fabric_pipeline_map.json`

URL pattern (matches [Fabric pipeline run view](https://app.fabric.microsoft.com/workloads/data-pipeline/artifactAuthor/workspaces/c5097ffb-b78e-441d-9575-a82bac23cac8/pipelines/a3401580-ada4-49c7-8efe-55a94295a020/0346ab63-a7c9-42d8-8f80-92ecf515f1ad?experience=fabric-developer)):

```
.../workspaces/{workspaceId}/pipelines/{artifactId}/{PipelineRunId}?experience=fabric-developer
```

To add a pipeline: open it in Fabric, copy the artifact GUID from the browser URL (`/pipelines/` segment), and add it to `pipelinesByConfigId`, `pipelinesByPipelineName`, or `pipelinesByConfigName` in `DATA/fabric_pipeline_map.json`.

## What's included

- **Home** — daily KPIs, recent runs
- **Trends** — success/failure charts
- **Pipelines** — module catalog + BR/SL/GL layer drill-down
- **Site Failures** — failed tasks + site audit panel
- **Data Quality** — non-PASS validation rows
- **Run Explorer** — search by RunId / PipelineRunId / site
- **Chat** — rule-based ops assistant (predefined queries only)

Plans: `DATA/react implmentationplan.md`
