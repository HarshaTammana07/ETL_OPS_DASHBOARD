# ETL Operations Center — API

Read-only FastAPI backend for the React dashboard. Serves KPIs, trends, failures, data quality, run search, and chat intents.

## Run

```powershell
cd tools/etl-ops-api
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

## Local data

On first start, CSV files from `DATA/` are loaded into `data/sample.db` (gitignored).

## Endpoints

See `app/routes/` — all read-only GET + `POST /api/chat`.
