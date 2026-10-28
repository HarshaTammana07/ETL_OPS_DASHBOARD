# ETL Operations Center — Application Overview & User Guide

**Platform Overview:** Centralized ETL Observability & Monitoring Platform for Microsoft Fabric Data Pipelines  

---

## 1. Executive Summary

The **ETL Operations Center** is an observability and monitoring dashboard built to deliver real-time health tracking, performance insights, and incident triage across data pipelines operating in **Microsoft Fabric**.

By centralizing execution telemetry across all **117+ data pipelines** and thousands of daily clinic ingestion tasks (spanning Bronze, Silver, and Gold layers), the platform bridges high-level operational health indicators with granular technical root-cause analysis.

### Core Objectives
- **Accelerate Incident Detection & Resolution:** Immediate visibility into failing tasks, site-specific issues, and pipeline bottlenecks.
- **Deep-Link Integration with Microsoft Fabric:** Instant 1-click navigation directly to exact pipeline execution runs and canvas editors in Microsoft Fabric.
- **Data Quality Governance:** Continuous automated validation tracking to guarantee data accuracy and compliance.
- **AI-Powered Diagnostics:** Natural language copilot enabling anyone to ask plain-English questions regarding pipeline health, daily KPIs, and error trends.

---

## 2. Platform Architecture & Data Flow

```
┌─────────────────────────────────┐
│     Microsoft Fabric Lakehouse  │ (Lakehouse metadata: pipelinerun, taskqueue,
│        & Data Pipelines         │  taskaudit, etlconfig, dataquality)
└────────────────┬────────────────┘
                 │ Live SQL Analytics Endpoint & Fabric REST API
                 ▼
┌─────────────────────────────────┐
│     FastAPI Backend Service     │ (Automatic token caching, deep-link resolver,
│     (tools/etl-ops-api)         │  dynamic catalog sync & AI copilot agent)
└────────────────┬────────────────┘
                 │ Secure JSON REST APIs / Reactive SSE
                 ▼
┌─────────────────────────────────┐
│     React SPA Web Frontend      │ (TanStack Query, Recharts,
│     (tools/etl-ops-web)         │  CST Time standardization & responsive UI)
└─────────────────────────────────┘
```

---

## 3. Screen-by-Screen User Guide

---

### Screen 1: Home — Operations Overview & Recent Runs

**URL Path:** `/`  

#### Overview & Purpose
The **Home Dashboard** serves as the primary operational entry point for the entire data platform. It delivers real-time visibility into overall platform health, success rates, in-progress jobs, and recently completed pipeline runs.

> 📸 **[Screenshot Placeholder: Home Screen — KPI Bar & Recent Runs View]**  
> *(Insert a screenshot showing the top KPI summary bar, date preset filters, and the grouped recent runs list)*

#### Key Components & Capabilities
1. **Interactive KPI Metric Cards:**
   - **Total Runs:** Total pipeline layer executions within the selected timeframe.
   - **Success Rate (%):** Overall percentage of successful executions (color-coded for quick visual evaluation).
   - **Failed Runs:** Instant count of failing runs; clicking this card automatically filters the runs list below to failures.
   - **Running Jobs:** Real-time count of currently active in-flight executions.
   - **Failed Sites:** Count of distinct healthcare clinics/sites impacted by ingestion errors in the Bronze layer.
2. **Timeframe & Scope Controls:**
   - Quick date presets: **Today**, **Yesterday**, **Last 3 Days**, **Last 7 Days**, or custom calendar date ranges.
   - All timestamps across the platform are standardized to Central Standard Time (**CST**).
3. **Grouped Pipeline Runs List:**
   - Aggregates multi-layer executions (Bronze ➔ Silver ➔ Gold) under a single master pipeline run.
   - **Direct Microsoft Fabric Deep Links (`Fabric ↗`):** Directly opens the specific run in Microsoft Fabric without having to search manually.
   - **Combined Layer Audit Button:** Allows reviewing end-to-end multi-layer progress in a single view.

---

### Screen 2: Expanded Run Details Drawer

**Invocation:** Click on any run or task across the dashboard  

#### Overview & Purpose
The **Expanded Run Details Drawer** provides a complete 360-degree inspection of a specific pipeline execution without navigating away from the current page.

> 📸 **[Screenshot Placeholder: Expanded Run Details Drawer — Metadata & Task Audit]**  
> *(Insert a screenshot showing the drawer open on the right, displaying the metadata cards, action buttons, and task list)*

#### Key Components & Capabilities
1. **Execution Metadata Badges:**
   - Displays exact **Pipeline Run ID**, **Run ID**, **Config ID**, **Fabric Pipeline Name**, and **Execution Timestamps**.
2. **Action Bar:**
   - **Open in Fabric (`↗`):** Direct authenticated deep-link taking you straight to the Microsoft Fabric pipeline execution trace or canvas editor.
   - **View Trends (All Layers):** Jumps to historical trend charts for this pipeline.
   - **Open in Run Explorer:** Loads this exact run into the search explorer for deeper filtering.
3. **Task Audit Table & Traceback Viewer:**
   - Breakdown of every task executed within the run (e.g., individual site copies, stored procedures, notebooks).
   - **Status Filtering:** Quickly toggle between `All`, `Success`, and `Failed` tasks.
   - **1-Click Copy Error:** Formats the complete error message, site code, and task name into a standardized template for Jira, Teams, or ticketing systems.

---

### Screen 3: Trends & Reliability Analytics

**URL Path:** `/trends`  

#### Overview & Purpose
The **Trends Page** delivers historical analytics over customizable windows (7 days, 14 days, 30 days, or custom). It enables tracking platform stability, spotting recurring failure patterns, and reviewing processing durations across architectural layers.

> 📸 **[Screenshot Placeholder: Trends Page — Success Rates, Layer Duration & Failure Distribution]**  
> *(Insert a screenshot showing the reliability trend charts, duration bar charts, and top failing pipelines table)*

#### Key Components & Capabilities
1. **Reliability & Volume Trends (Interactive Charts):**
   - Daily success vs. failure rates over time to measure platform stability.
   - Interactive tooltips showing exact counts per date.
2. **Layer Duration Analysis (Bronze vs. Silver vs. Gold):**
   - Average execution times broken down by medallion architecture layer.
   - Highlights performance degradation and long-running pipelines before they impact downstream workloads.
3. **Top Failing Pipelines Leaderboard:**
   - Ranks pipelines with the highest failure frequency over the selected period.
   - Pinpoints areas requiring engineering optimization or configuration adjustments.

---

### Screen 4: Site Failures Center

**URL Path:** `/failures`  

#### Overview & Purpose
Because data is ingested across numerous physical medical clinics and remote sites, site-specific connection drops or format discrepancies are a primary focus. The **Site Failures Center** groups errors by clinical site code (e.g., `AHK — Ahoskie`, `BHR — Behavioral Health`, etc.), allowing issues to be diagnosed per location.

> 📸 **[Screenshot Placeholder: Site Failures Matrix & Clinic Failure Summary]**  
> *(Insert a screenshot showing the site failure grid cards, error count by site, and last failure timestamp)*

#### Key Components & Capabilities
1. **Site Impact Summary Grid:**
   - Visual cards showing each affected clinic, total failures, impacted pipelines, and time of last incident.
2. **Site Incident Drawer:**
   - Clicking any site card opens a dedicated drawer listing all tasks that failed for that clinic.
   - Shows database name, error message summary, and exact timestamp.
3. **Incident Export & Collaboration Tools:**
   - **Copy All (Bulk Incident Export):** Copies all failures to the clipboard formatted for operational reports or tickets.
   - **Fabric Deep-Links:** Jump directly to Microsoft Fabric to inspect or rerun the specific pipeline.

---

### Screen 5: Data Quality Assurance Center

**URL Path:** `/data-quality`  

#### Overview & Purpose
Even when a pipeline completes successfully, individual data records may violate business rules, contain NULL values in required fields, or fail integrity checks. The **Data Quality Page** isolates non-PASS validation records to protect downstream analytics and reporting.

> 📸 **[Screenshot Placeholder: Data Quality Page — Rule Violations & Quality Trends]**  
> *(Insert a screenshot showing data quality validation status, rule failure table, and impacted record counts)*

#### Key Components & Capabilities
1. **Validation Rule Results:**
   - Summary of validation tests (e.g., Row Count Verification, Key Uniqueness, Column Schema Validation, Null Constraints).
2. **Non-PASS Issue Log:**
   - Tabular view of records marked as `WARN`, `FAIL`, or `ERROR`.
   - Displays affected Target Table, Rule Name, Failing Condition, and Sample Error Snippet.
3. **Severity Breakdown:**
   - Distinguishes between informational warnings and critical business blockers.

---

### Screen 6: Pipeline Architecture & Catalog Explorer

**URL Path:** `/pipelines`  

#### Overview & Purpose
The **Pipelines Page** provides an interactive directory of all active and inactive ETL pipelines across the platform. It maps out the orchestration topology and allows drilling down into specific medallion layers.

> 📸 **[Screenshot Placeholder: Pipeline Catalog Screen — Module Filter & Layer Breakdown]**  
> *(Insert a screenshot showing the pipeline directory, layer badges BR/SL/GL, and module categorization)*

#### Key Components & Capabilities
1. **Comprehensive Pipeline Directory:**
   - Searchable catalog of all 117+ configured pipelines.
   - Displays source systems (e.g., SAMMS, UKG, Salesforce, 8x8, Azure SQL) and target tables.
2. **Medallion Layer Categorization:**
   - Clear filtering between **Bronze (Raw Ingestion)**, **Silver (Cleaned & Conformed)**, and **Gold (Aggregated Business Models)**.
3. **Execution History Drill-Down:**
   - Click any pipeline to view its dedicated run history and task audit records.

---

### Screen 7: Granular Run Explorer

**URL Path:** `/runs`  

#### Overview & Purpose
The **Run Explorer** is the primary search and investigation tool for specific execution instances. When an investigation references a `PipelineRunId`, `RunId`, or clinic site code, this screen enables locating the exact record within seconds.

> 📸 **[Screenshot Placeholder: Run Explorer — Search Bar, Mode Selector & Results Table]**  
> *(Insert a screenshot showing the search input with mode selector dropdown and filtered results)*

#### Key Components & Capabilities
1. **Multi-Mode Search Engine:**
   - **Smart Search:** Searches across names, identifiers, and configuration labels.
   - **Pipeline Run ID Search:** Exact lookup for Microsoft Fabric execution GUIDs.
   - **Layer Run ID Search:** Exact lookup for specific database/layer execution IDs.
   - **Site Code Search:** Filters runs containing tasks for a designated clinic.
2. **Integrated Drawer Inspection:**
   - Selecting any row immediately opens the full run card drawer with complete task-level audits.

---

### Screen 8: Operational Alerts & Live Notifications

**URL Path:** `/alerts`  

#### Overview & Purpose
The **Alerts Page** presents a chronologically organized feed of operational alerts generated by platform exceptions, failed tasks, and Fabric notebook alerts.

> 📸 **[Screenshot Placeholder: Alerts Page — Incident Stream & Severity Filtering]**  
> *(Insert a screenshot showing the notification feed, severity tags, and incident detail expandable view)*

#### Key Components & Capabilities
1. **Incident Feed:**
   - Real-time event stream showing pipeline failures and system warnings.
2. **Severity Badges:**
   - Clear visual indicators (`Critical`, `Error`, `Warning`, `Info`) for rapid prioritization.
3. **Contextual Action Links:**
   - Direct link to the affected pipeline and Fabric run for immediate remediation.

---

### Screen 9: AI Operations Copilot (Chat)

**URL Path:** `/chat`  

#### Overview & Purpose
The **AI Operations Copilot** provides an intuitive conversational interface powered by large language models integrated with read-only operational telemetry tools. It allows anyone on the team to ask natural language questions without needing SQL or manual filtering.

> 📸 **[Screenshot Placeholder: AI Chat Screen — Prompt Examples & Agent Response]**  
> *(Insert a screenshot showing the chat interface with a question like "Which pipelines failed today?" and the AI response)*

#### Example Queries Supported:
- *"What is our overall pipeline success rate today?"*
- *"Which clinics experienced failures in the Bronze layer this morning?"*
- *"Why did the SAMMS INV Bronze Pipeline fail?"*
- *"Show me the average duration of Silver layer pipelines over the last 7 days."*

---

## 4. Key Operational Features Reference

| Feature | Description | Benefit |
|---|---|---|
| **Direct Fabric Deep-Linking** | URLs auto-link to Fabric run executions (`/pipelines/{id}/{runId}`) or canvas editor (`/pipelines/{id}`). | Eliminates manual searching inside the Microsoft Fabric portal. |
| **CST Time Standardization** | All database UTC timestamps are converted to CST across all screens, charts, and drawers. | Team-wide synchronization around US Central business operating hours. |
| **1-Click Incident Copy** | Standardized markdown incident format copied with one button. | Eliminates manual typing when filing tickets or notifying communication channels. |
| **Dynamic Pipeline Discovery** | Live REST sync with Microsoft Fabric workspace items. | Automatically detects and maps new pipelines without manual JSON edits. |

---

## 5. Summary

This document outlines the operational capabilities and screens of the **ETL Operations Center**. For further details, technical specifications, or assistance, please refer to the application help section or contact the data platform engineering team.
