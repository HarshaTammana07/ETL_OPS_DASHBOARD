import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "../components/FabricLink";
import { KpiCard } from "../components/KpiCard";
import { LayerBadge } from "../components/StatusBadge";
import { TablePagination } from "../components/TablePagination";
import { buildTrendsHref } from "../components/TrendsScopeBar";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import type { NotificationAlert } from "../types";

const PAGE_SIZE = 25;

function formatTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19).replace("T", " ");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertCard({ alert }: { alert: NotificationAlert }) {
  const [open, setOpen] = useState(false);
  const runId = alert.PipelineRunId || alert.RunId;

  return (
    <article className="rounded-xl border border-red-900/40 bg-red-950/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-300/80">Failure alert</p>
          <h3 className="text-sm font-semibold text-slate-100">{alert.Title || alert.Summary}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {alert.TargetName && <LayerBadge layer={alert.TargetName} />}
            {alert.SourceSystem && <span>{alert.SourceSystem}</span>}
            <span>{formatTime(alert.EndTime || alert.StartTime || alert.CreatedAt)}</span>
            {alert.Source === "audit_backfill" && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">from audit</span>
            )}
            {alert.Source === "teams_webhook" && (
              <span className="rounded bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-300">from Teams notebook</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {open ? "Collapse" : "Details"}
        </button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-slate-500">Config</dt>
          <dd className="text-slate-200">{alert.ConfigName || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pipeline</dt>
          <dd className="truncate text-slate-200" title={alert.PipelineName}>
            {alert.PipelineName || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Failed tasks</dt>
          <dd className="font-medium text-red-200">{alert.FailedCount || 0}</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-slate-500">Error</dt>
          <dd className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-red-100/90">
            {alert.ErrorSummary || "No error summary"}
          </dd>
        </div>
      </dl>

      {open && (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/80 p-3 text-[12px] leading-relaxed text-red-100/90">
          {alert.FailureDetails || alert.ErrorSummary || "No failure details"}
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
  const queryClient = useQueryClient();
  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: summary } = useQuery({
    queryKey: ["notificationSummary", filters],
    queryFn: () => api.notificationSummary(filters),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", filters, PAGE_SIZE, offset],
    queryFn: () => api.notifications({ ...filters, limit: PAGE_SIZE, offset }),
  });

  const backfill = useMutation({
    mutationFn: () => api.backfillNotifications({ ...filters, limit: 300 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notificationSummary"] });
      setPage(1);
    },
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Alerts</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Failure notifications only — same story as BHG Teams. Live alerts arrive when Fabric notebooks dual-write
            to this API. Past days can be seeded from audit tables (Teams webhooks cannot be queried historically).
          </p>
          <p className="mt-1 text-xs text-slate-500">Window: {dateLabel || "set dates above"}</p>
        </div>
        <button
          type="button"
          onClick={() => backfill.mutate()}
          disabled={backfill.isPending}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {backfill.isPending ? "Loading…" : "Load from audit (this window)"}
        </button>
      </div>

      {backfill.isSuccess && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Backfill: {backfill.data.inserted} inserted · {backfill.data.skipped} already present ·{" "}
          {backfill.data.scanned} failed runs scanned
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Failure alerts" value={summary?.totalAlerts ?? 0} tone="danger" hint={dateLabel} />
        <KpiCard label="Pipelines" value={summary?.pipelines ?? 0} hint="Distinct configs" />
        <KpiCard label="Failed tasks" value={summary?.failedTasks ?? 0} tone={summary?.failedTasks ? "danger" : "default"} />
        <KpiCard
          label="By layer"
          value={`${summary?.byLayer.BR ?? 0} / ${summary?.byLayer.SL ?? 0} / ${summary?.byLayer.GL ?? 0}`}
          hint="BR / SL / GL"
        />
      </div>

      {isLoading && <p className="text-slate-400">Loading alerts…</p>}
      {isFetching && !isLoading && <p className="text-xs text-slate-500">Updating…</p>}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-8 text-center">
          <p className="text-sm text-slate-300">No failure alerts in this window</p>
          <p className="mt-2 text-xs text-slate-500">
            Click <span className="text-slate-300">Load from audit</span> to seed today/yesterday from pipeline failures,
            or wait for live dual-write from the notification notebook.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((alert) => (
          <AlertCard key={alert.Id} alert={alert} />
        ))}
      </div>

      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="justify-between" />
    </div>
  );
}
