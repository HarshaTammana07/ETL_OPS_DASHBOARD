ETL Operations Center — POC Plan

Purpose: Build an application on top of Fabric control and audit tables for daily health checks, 7-day run history, KPIs, Teams alerts, and a chatbot that answers from operational metadata.

Audience: Data engineering / platform team
Status: POC planning
Related docs: BCAppCode/Framework/controlAudittables.txt, BCAppCode/Framework/Howtostart.md



Executive Summary

After the Fabric migration, pipelines write run state into six meta tables in bhg_bronze.meta. This POC turns that data into an ETL Operations Center:





Daily health dashboard — today's runs, success rate, failures, SLA breaches



7-day history — what ran, what failed, trends



Drill-down — pipeline → layer → site → error message



Teams alerts — real-time failure + daily digest



Chatbot — natural-language questions against predefined, read-only queries





Source Tables (Control + Audit)







Table



Role





meta.etlconfig



Which pipelines/layers exist (BR / SL / GL)





meta.taskconfig



Executable tasks (per site or per method)





meta.pipelinerun



One row per layer per parent run — SUCCESS / FAILED





meta.taskqueue



Live task state — RUNNING → SUCCESS / FAILED / SKIPPED





meta.taskaudit



Final audit — row counts, duration, errors, per site





meta.dataquality



Row / null / duplicate counts, validation status



Note: Teams often refer to "5 control tables." In practice there are 6 — dataquality is the sixth. meta.siteaudit is deprecated for DartsSrv; use taskaudit instead.



Join keys

etlconfig (ConfigId)
  → pipelinerun (RunId, ConfigId)
  → taskqueue (TaskId, RunId, TaskConfigId)
  → taskaudit (AuditId, TaskId, RunId)
  → dataquality (RunId, ConfigId)
taskconfig (TaskConfigId, ConfigId) for SiteCode / Method / TargetTable

Reference: BCAppCode/Framework/controlAudittables.txt





Recommended POC Architecture

┌─────────────────────────────────────────────────────────────┐
│  Fabric (source of truth)                                    │
│  bhg_bronze.meta.*  →  SQL views (vw_etl_*)                 │
│       ↓                                                      │
│  Fabric Warehouse SQL endpoint (best for POC)                │
└─────────────────────────────────────────────────────────────┘
         ↓                              ↓
┌─────────────────────┐    ┌──────────────────────────────┐
│ Streamlit app       │    │ Scheduled health notebook     │
│ (KPIs + tables)     │    │ + Power Automate → Teams      │
│ tools/etl-ops-      │    │ (alerts + daily digest)       │
│ dashboard/          │    │                               │
└─────────────────────┘    └──────────────────────────────┘
         ↓
┌─────────────────────┐
│ Chatbot tab         │
│ Azure OpenAI +      │
│ predefined SQL      │
│ (safe read-only)    │
└─────────────────────┘



Why this stack for POC







Component



Rationale





Streamlit



Fast Python UI; fits the repo; no heavy frontend





Fabric Warehouse SQL



Read meta tables without copying data





Power Automate → Teams



Centralizes alerts (per-pipeline nb_*_notify_failed notebooks already exist)





Chatbot v1



Canned questions → parameterized queries (safe, accurate). No free-form SQL in v1.

Later: Swap Streamlit for Power BI or a React app; add Fabric Data Activator as an alternative alert path.





Step-by-Step Execution Plan



Phase 0 — Inputs required (1–2 days)

Provide the following to start the POC:







#



Item



Format



Why





1



Excel export of all 6 meta tables



.xlsx or CSV, last 30 days if possible



Local dev without live Fabric 24/7; validate status values





2



Module inventory



List of ConfigName prefixes



e.g. SAMMS DartsSrv%, P1 Reference%, SAMMS Dose%, Notes, Forms, PPA, Finance





3



Which modules use audit framework



Checklist



Some pipelines may not write all 6 tables yet





4



Fabric connection details



Warehouse SQL endpoint + auth (AAD)



App reads live data





5



Teams channel



Incoming webhook URL or Power Automate HTTP trigger



Alerts





6



Alert rules



Simple doc



e.g. any pipelinerun.Status = FAILED → immediate Teams





7



SLA expectations (optional)



e.g. Darts must finish by 6 AM



KPI red / yellow / green





8



Azure OpenAI (optional)



Endpoint + deployment name



Skip in v1 → rule-based Q&A only



Excel sheets (one tab each)





etlconfig



taskconfig (can be large — at least active rows)



pipelinerun



taskqueue



taskaudit



dataquality

Also helpful: 2–3 example failure scenarios (site timeout, silver merge fail, zero rows copied).





Phase 1 — Data model and views (Week 1)



Step 1.1 — Document canonical status values

From Excel / prod, confirm exact strings:





pipelinerun.Status: SUCCESS, FAILED, RUNNING, …?



taskqueue.Status: RUNNING, SUCCESS, FAILED, SKIPPED, …?



taskaudit.Status: same?



Step 1.2 — Create reporting views in Fabric

Artifact: BCAppCode/Framework/EtlOps/etl_ops_views.sql







View



Purpose





vw_etl_run_summary



One row per parent pipeline run (join BR + SL + GL)





vw_etl_failures_7d



All failed taskqueue / taskaudit rows, last 7 days





vw_etl_site_health



Bronze per-site success rate by ConfigName





vw_etl_daily_kpi



Date, total runs, success %, failed sites, avg duration





vw_etl_dq_issues



dataquality where ValidationStatus <> 'PASS'



Step 1.3 — Define "parent run"

Many ETLs create 3 RunIds (BR, SL, GL) per execution. Group for the dashboard:





Option A (POC): group by PipelineName + date(StartTime) + TriggeredBy window



Option B (later): add ParentRunId to audit writer (cleaner, more work)

For POC, use Option A.





Phase 2 — KPI dashboard POC (Week 1–2)



Step 2.1 — Repo structure

tools/etl-ops-dashboard/
  app.py                 # Streamlit main
  queries.py             # Parameterized SQL
  chatbot.py             # Canned Q&A (v1) / OpenAI (v2)
  config.yaml            # Connection string, lookback days
  config.example.yaml
  requirements.txt
  README.md
  data/                  # Excel → sample DB (gitignored)

BCAppCode/Framework/EtlOps/
  etl_ops_views.sql
  nb_etl_ops_daily_health_check.py
  EtlOps_Dashboard_POC_Plan.md   # this file



Step 2.2 — POC screens







Screen



KPIs / content





Home — Today



Total pipeline runs, success %, failed count, running now, sites failed (bronze)





Last 7 days



Trend: runs vs failures by day; top 5 failing pipelines





Pipeline detail



Filter by ConfigName; BR / SL / GL status; duration





Site detail



Failed sites: SiteCode, DataBaseName, ErrorMessage, RowsRead / Written





Data quality



DQ failures, null / duplicate spikes





Run explorer



Search by RunId, date, SiteCode



Step 2.3 — Local dev from Excel

Until Fabric SQL is wired:





Load Excel → SQLite in tools/etl-ops-dashboard/data/sample.db



Same queries; swap connection in config.yaml





Phase 3 — Teams notifications (Week 2)



Step 3.1 — Central health notebook

Notebook: nb_etl_ops_daily_health_check





Schedule: every 15 min (failures) + 7 AM (daily digest)



Queries vw_etl_failures_7d and today's failures



Outputs JSON for Teams / Power Automate



Step 3.2 — Power Automate flow

Trigger: HTTP (from notebook) OR Recurrence + notebook
  → Parse JSON
  → Post to Teams channel (Adaptive Card)

Adaptive Card fields:





Pipeline name, layer, status, failed site count



Top 5 errors (truncated)



Link to dashboard (Streamlit URL or Fabric workspace)



Step 3.3 — Alert types for POC







Alert



When



Channel





Immediate



New pipelinerun.Status = FAILED since last check



Teams





Site failure



Bronze taskqueue.Status = FAILED



Teams





Daily digest



7 AM — yesterday summary + 7-day failure list



Teams





DQ warning



dataquality.ValidationStatus != PASS



Teams (optional)



Per-pipeline nb_*_notify_failed notebooks are not replaced by this POC — they are aggregated into one ops view.





Phase 4 — Chatbot POC (Week 2–3)



Step 4.1 — v1: safe, no free-form SQL

Predefined intents → parameterized queries:







User question



Backend query





"What failed today?"



vw_etl_failures_7d WHERE run_date = today





"Darts failures this week?"



filter ConfigName LIKE 'SAMMS DartsSrv%'





"Did site AHK run successfully?"



taskaudit for SiteCode = AHK, latest





"Row counts for last Darts silver run?"



latest SL taskaudit.RowsWritten





"Which pipelines are still running?"



taskqueue.Status = RUNNING



Step 4.2 — v2: Azure OpenAI





System prompt: answer only from provided query results



Tools / functions: get_failures, get_pipeline_status, get_site_audit



Never expose write access or arbitrary SQL



Step 4.3 — UI

Streamlit chat tab; show table + summary; optional "copy SQL" for engineers.





Phase 5 — Harden and demo (Week 3)



Step 5.1 — Auth





POC: Streamlit on internal network / VPN



Prod: Azure App Service + Entra ID login



Step 5.2 — Demo script





Show today's KPIs (mostly green)



Drill into a known failure from sample Excel



Show 7-day trend



Ask chatbot 3 questions



Trigger test Teams alert



Step 5.3 — POC sign-off criteria





All 6 tables represented in views



7-day failure list accurate vs manual SQL



At least 3 pipelines covered (e.g. Darts, Dose, P1 Reference)



Teams alert received within 5 min of test failure



Chatbot answers 10 canned questions correctly





KPI List for the UI



Executive (top cards)





Pipelines run today / success rate %



Failed pipeline runs (24h)



Failed bronze sites (24h)



Avg end-to-end duration (BR + SL)



Pipelines still running



Operational (tables / charts)





Failures by pipeline (bar, 7d)



Failures by site (top 10)



Layer failure breakdown (BR vs SL vs GL)



Retry / restart count (RestartFlag, AttemptNumber)



Zero-row extracts (RowsRead = 0 but SUCCESS — data anomaly)



DQ validation failures



Trend





Daily success rate (7 / 30 days)



Mean duration by pipeline





Post-POC Extensions





Fabric Data Activator — native alerts on Delta tables



Power BI semantic model — executive reporting on same views



Run comparison — today vs yesterday row counts per site



SLA heatmap — pipeline × day of week



On-call rotation — route Teams alerts by module owner



Self-heal hooks — "Retry failed site" → trigger Fabric pipeline with site param



Unified notify — replace many nb_*_notify_failed notebooks with one framework notifier





Suggested pilot pipelines

Start with modules that have the fullest audit framework coverage:







Pipeline



ConfigName pattern



Notes





DartsSrv



SAMMS DartsSrv%



Bronze per-site; reference implementation





Dose



SAMMS Dose%



BR + SL audit





P1 Reference



P1 Reference% or similar



Multi-method bronze/silver

Add Notes, Forms, PPA, Finance after POC validation.





Immediate next steps





Export Excel — 6 meta tables, last 30 days (or full if smaller)



Send module list — which ConfigName patterns exist in prod



Confirm Teams setup — webhook or Power Automate preference



Pick 3 pilot pipelines (suggest: DartsSrv, Dose, P1 Reference)



Share Fabric SQL endpoint — or "Excel only for now" for offline-first build





Appendix — Example view stubs

-- vw_etl_failures_7d (illustrative — adjust status literals after Phase 0)
CREATE OR ALTER VIEW meta.vw_etl_failures_7d AS
SELECT
    pr.RunId,
    pr.ConfigId,
    pr.ConfigName,
    pr.PipelineName,
    pr.TargetName,
    pr.Status          AS PipelineStatus,
    pr.StartTime,
    pr.EndTime,
    tq.TaskId,
    tq.TaskName,
    tq.SiteCode,
    tq.DataBaseName,
    tq.Status          AS TaskStatus,
    tq.ErrorMessage,
    ta.RowsRead,
    ta.RowsWritten,
    ta.DurationSeconds
FROM meta.pipelinerun pr
LEFT JOIN meta.taskqueue tq ON tq.RunId = pr.RunId
LEFT JOIN meta.taskaudit ta ON ta.TaskId = tq.TaskId
WHERE pr.CreatedAt >= DATEADD(day, -7, GETDATE())
  AND (
        pr.Status = 'FAILED'
     OR tq.Status IN ('FAILED', 'SKIPPED')
     OR ta.Status = 'FAILED'
  );

-- vw_etl_daily_kpi (illustrative)
CREATE OR ALTER VIEW meta.vw_etl_daily_kpi AS
SELECT
    CAST(pr.CreatedAt AS date)     AS RunDate,
    pr.ConfigName,
    COUNT(DISTINCT pr.RunId)       AS LayerRuns,
    SUM(CASE WHEN pr.Status = 'SUCCESS' THEN 1 ELSE 0 END) AS SuccessCount,
    SUM(CASE WHEN pr.Status = 'FAILED'  THEN 1 ELSE 0 END) AS FailedCount,
    AVG(DATEDIFF(second, pr.StartTime, pr.EndTime))        AS AvgDurationSec
FROM meta.pipelinerun pr
WHERE pr.CreatedAt >= DATEADD(day, -30, GETDATE())
GROUP BY CAST(pr.CreatedAt AS date), pr.ConfigName;





Document history







Version



Date



Notes





1.0



2026-09-08



Initial POC plan

