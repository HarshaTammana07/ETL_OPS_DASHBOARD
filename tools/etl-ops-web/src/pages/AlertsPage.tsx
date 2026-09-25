import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "../components/FabricLink";
import { LayerBadge } from "../components/StatusBadge";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { buildTrendsHref } from "../components/TrendsScopeBar";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import type { NotificationAlert } from "../types";
import { formatCstDate, formatCstDateTime, formatCstTime } from "../utils/formatDate";

function formatIncidentText(alert: NotificationAlert): string {
  const timeVal = alert.EndTime || alert.StartTime || alert.CreatedAt;
  return `[ETL Failure Alert]
Pipeline: ${alert.PipelineName || alert.ConfigName || "Unknown"}
Layer: ${alert.TargetName || "N/A"}
Time (CST): ${formatCstDateTime(timeVal)}
Run ID: ${alert.PipelineRunId || alert.RunId || "N/A"}
Failed Tasks: ${alert.FailedCount || 1}
Error Summary:
${alert.ErrorSummary || "No error summary recorded."}

Full Traceback:
${alert.FailureDetails || alert.ErrorSummary || "No traceback recorded."}`;
}

function AlertTableRow({ alert }: { alert: NotificationAlert }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const runId = alert.PipelineRunId || alert.RunId;
  const timeVal = alert.EndTime || alert.StartTime || alert.CreatedAt;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatIncidentText(alert));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer transition-colors border-b border-slate-800/60 ${
          expanded ? "bg-red-950/25" : "hover:bg-slate-800/50"
        }`}
        title="Click to toggle error traceback"
      >
        {/* Date & Time (Stacked) */}
        <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] leading-tight">
          <div className="font-semibold text-slate-200">{formatCstDate(timeVal)}</div>
          <div className="text-[10px] text-slate-400">{formatCstTime(timeVal)}</div>
        </td>

        {/* Layer Badge */}
        <td className="px-3.5 py-2.5 whitespace-nowrap">
          {alert.TargetName ? <LayerBadge layer={alert.TargetName} /> : <span className="text-slate-600">—</span>}
        </td>

        {/* Pipeline & Config */}
        <td className="max-w-[220px] px-3.5 py-2.5">
          <div className="font-semibold text-slate-100 truncate text-xs" title={alert.PipelineName || alert.ConfigName}>
            {alert.PipelineName || alert.ConfigName}
          </div>
          {alert.ConfigName && alert.ConfigName !== alert.PipelineName && (
            <div className="text-[10px] text-slate-400 truncate mt-0.5" title={alert.ConfigName}>
              {alert.ConfigName}
            </div>
          )}
        </td>

        {/* Source System */}
        <td className="px-3.5 py-2.5 whitespace-nowrap">
          {alert.SourceSystem ? (
            <span className="rounded bg-slate-800/90 border border-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              {alert.SourceSystem}
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </td>

        {/* Failed Tasks Pill */}
        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
          <span className="inline-flex items-center justify-center rounded-full bg-red-950/80 border border-red-800/60 px-2.5 py-0.5 text-[11px] font-bold text-red-300 tabular-nums">
            {alert.FailedCount || 1}
          </span>
        </td>

        {/* Error Summary */}
        <td className="max-w-[320px] px-3.5 py-2.5 font-mono text-[11px] text-red-200/90 truncate" title={alert.ErrorSummary}>
          {alert.ErrorSummary || "Pipeline execution failed"}
        </td>

        {/* Actions */}
        <td className="whitespace-nowrap px-3.5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
              title="Copy formatted incident details for Teams or Jira"
            >
              {copied ? (
                <>
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {alert.PipelineRunId && (
              <Link
                to={`/runs?pipelineRunId=${encodeURIComponent(alert.PipelineRunId)}`}
                className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-sky-400 hover:underline hover:text-sky-300"
              >
                Run
              </Link>
            )}

            <FabricLink
              url={alert.fabricUrl}
              meta={rowToRunMeta({
                RunId: alert.RunId,
                PipelineRunId: alert.PipelineRunId,
                ConfigName: alert.ConfigName,
                PipelineName: alert.PipelineName,
                TargetName: alert.TargetName,
                Status: "FAILED",
                StartTime: alert.StartTime,
                EndTime: alert.EndTime,
                fabricUrl: alert.fabricUrl || "",
              })}
              label="Fabric"
            />

            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
              title="Toggle error details"
            >
              {expanded ? "▲" : "▼"}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Traceback Drawer Row */}
      {expanded && (
        <tr className="bg-slate-950/80 border-b border-slate-800">
          <td colSpan={7} className="px-5 py-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                  Incident Traceback & Diagnostics
                </span>
                {runId && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Run ID: <span className="text-slate-200">{runId}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {runId && (
                  <Link
                    to={buildTrendsHref({
                      pipelineRunId: alert.PipelineRunId || undefined,
                      runId: alert.PipelineRunId ? undefined : alert.RunId || undefined,
                    })}
                    className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-slate-700"
                  >
                    View trends
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-200 hover:text-white"
                >
                  {copied ? "✓ Copied to Clipboard" : "Copy Full Incident"}
                </button>
              </div>
            </div>

            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900/90 p-3 font-mono text-xs leading-relaxed text-red-200 border border-red-900/40 shadow-inner">
              {alert.FailureDetails || alert.ErrorSummary || "No failure traceback recorded."}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function AlertFeedCard({ alert }: { alert: NotificationAlert }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const runId = alert.PipelineRunId || alert.RunId;
  const timeVal = alert.EndTime || alert.StartTime || alert.CreatedAt;

  const handleCopy = () => {
    navigator.clipboard.writeText(formatIncidentText(alert));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Failure Incident
            </span>
            {alert.TargetName && <LayerBadge layer={alert.TargetName} />}
            <span className="text-xs font-mono text-slate-400">{formatCstDateTime(timeVal)}</span>
          </div>

          <h3 className="text-sm font-semibold text-slate-100">{alert.PipelineName || alert.ConfigName}</h3>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {alert.SourceSystem && <span className="text-slate-300 font-medium">{alert.SourceSystem}</span>}
            <span>·</span>
            <span className="text-red-300 font-medium">{alert.FailedCount || 1} failed task{alert.FailedCount === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            {copied ? "✓ Copied" : "Copy Incident"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {open ? "Hide Details" : "View Details"}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 font-mono text-xs text-red-200/90 break-words">
        {alert.ErrorSummary || "Pipeline execution failed"}
      </div>

      {open && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-red-200 border border-red-900/40">
          {alert.FailureDetails || alert.ErrorSummary || "No failure traceback recorded."}
        </pre>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {runId && (
          <Link
            to={buildTrendsHref({
              pipelineRunId: alert.PipelineRunId || undefined,
              runId: alert.PipelineRunId ? undefined : alert.RunId || undefined,
            })}
            className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-slate-700"
          >
            View trends
          </Link>
        )}
        {alert.PipelineRunId && (
          <Link
            to={`/runs?pipelineRunId=${encodeURIComponent(alert.PipelineRunId)}`}
            className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-slate-700"
          >
            Run Explorer
          </Link>
        )}
        <FabricLink
          url={alert.fabricUrl}
          meta={rowToRunMeta({
            RunId: alert.RunId,
            PipelineRunId: alert.PipelineRunId,
            ConfigName: alert.ConfigName,
            PipelineName: alert.PipelineName,
            TargetName: alert.TargetName,
            Status: "FAILED",
            StartTime: alert.StartTime,
            EndTime: alert.EndTime,
            fabricUrl: alert.fabricUrl || "",
          })}
          label="Fabric"
        />
      </div>
    </article>
  );
}

export function AlertsPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<"ALL" | "BR" | "SL" | "GL">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const queryClient = useQueryClient();

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);

  const activeFilters = useMemo(() => {
    return {
      ...filters,
      targetName: layerFilter === "ALL" ? filters.targetName : layerFilter,
      q: search.trim() || undefined,
    };
  }, [filters, layerFilter, search]);

  const isAll = pageSize === -1;
  const offset = isAll ? 0 : (page - 1) * pageSize;
  const queryLimit = isAll ? 1000 : pageSize;

  const { data: summary } = useQuery({
    queryKey: ["notificationSummary", activeFilters],
    queryFn: () => api.notificationSummary(activeFilters),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", activeFilters, queryLimit, offset],
    queryFn: () => api.notifications({ ...activeFilters, limit: queryLimit, offset }),
  });

  const forceSync = useMutation({
    mutationFn: () => api.backfillNotifications({ ...activeFilters, limit: 300 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notificationSummary"] });
    },
  });

  useEffect(() => {
    setPage(1);
  }, [filters.configName, filters.targetName, filters.startDateFrom, filters.startDateTo, search, layerFilter]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3.5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Live Failure Alerts</h2>
            <span className="flex items-center gap-1 rounded-full bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Fabric Live Telemetry
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Real-time pipeline and task failure alerts{dateLabel ? ` · ${dateLabel}` : ""} — click any row to inspect errors or copy incident cards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => forceSync.mutate()}
          disabled={forceSync.isPending || isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors"
          title="Force immediate re-scan of failure audit records"
        >
          <svg
            className={`h-3.5 w-3.5 text-sky-400 ${forceSync.isPending || isFetching ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {forceSync.isPending || isFetching ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      {/* Sleek KPI Cards */}
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-red-900/40 bg-slate-900/60 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Failure Alerts</p>
          <p className="mt-1 text-2xl font-bold text-red-400 tabular-nums">{summary?.totalAlerts ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{dateLabel || "Selected period"}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pipelines Affected</p>
          <p className="mt-1 text-2xl font-bold text-slate-100 tabular-nums">{summary?.pipelines ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Distinct pipelines</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Failed Tasks</p>
          <p className="mt-1 text-2xl font-bold text-amber-300 tabular-nums">{summary?.failedTasks ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Task-level failures</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">By Layer</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-300">{summary?.byLayer.BR ?? 0}</span>
            <span className="text-xs text-slate-500">BR /</span>
            <span className="text-lg font-bold text-sky-300">{summary?.byLayer.SL ?? 0}</span>
            <span className="text-xs text-slate-500">SL /</span>
            <span className="text-lg font-bold text-yellow-300">{summary?.byLayer.GL ?? 0}</span>
            <span className="text-xs text-slate-500">GL</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Bronze · Silver · Gold</p>
        </div>
      </div>

      {/* Filter & View Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Layer Filters */}
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
          {[
            { id: "ALL", label: `All (${summary?.totalAlerts ?? 0})` },
            { id: "BR", label: `Bronze (${summary?.byLayer.BR ?? 0})` },
            { id: "SL", label: `Silver (${summary?.byLayer.SL ?? 0})` },
            { id: "GL", label: `Gold (${summary?.byLayer.GL ?? 0})` },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLayerFilter(l.id as any)}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${
                layerFilter === l.id
                  ? "bg-slate-700 font-semibold text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded px-2.5 py-1 ${
                viewMode === "table" ? "bg-slate-700 font-medium text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded px-2.5 py-1 ${
                viewMode === "cards" ? "bg-slate-700 font-medium text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Feed Cards
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pipeline or error..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 pl-8 pr-7 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-400 py-4">Loading failure alerts…</p>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-slate-200">No failure alerts in this period</p>
          <p className="mt-1 text-xs text-slate-500">
            {search
              ? `No alerts match query "${search}". Try clearing search.`
              : `All pipelines executed cleanly in ${dateLabel || "the selected range"}.`}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {/* Top Pagination */}
          <TablePaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100, -1]}
            label="failure alerts"
          />

          {viewMode === "table" ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-md">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/95 text-left uppercase tracking-wide text-slate-400 font-medium border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">When (CST)</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Layer</th>
                    <th className="px-3.5 py-2.5">Pipeline</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Source</th>
                    <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Failed Tasks</th>
                    <th className="px-3.5 py-2.5">Error Summary</th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((alert) => (
                    <AlertTableRow key={alert.Id} alert={alert} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((alert) => (
                <AlertFeedCard key={alert.Id} alert={alert} />
              ))}
            </div>
          )}

          {/* Bottom Pagination */}
          <TablePaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100, -1]}
            label="failure alerts"
          />
        </div>
      )}
    </div>
  );
}
