import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "../components/FabricLink";
import { LayerBadge, StatusBadge } from "../components/StatusBadge";
import type { FilterContext } from "../hooks/useFilterContext";
import type { FailedTask } from "../types";

type ViewMode = "sites" | "tasks";

function formatShortTime(value?: string): string {
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

function StatChip({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "danger" | "warn" }) {
  const tones = {
    default: "border-slate-700 bg-slate-900/70 text-slate-100",
    danger: "border-red-800/60 bg-red-950/40 text-red-100",
    warn: "border-amber-800/60 bg-amber-950/30 text-amber-100",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function FailuresPage() {
  const { filters, setFilters } = useOutletContext<FilterContext>();
  const [view, setView] = useState<ViewMode>("sites");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(filters.siteCode ?? null);

  const taskFilters = useMemo(
    () => ({
      ...filters,
      siteCode: selectedSite ?? filters.siteCode,
      limit: 100,
    }),
    [filters, selectedSite],
  );

  const { data: overview } = useQuery({
    queryKey: ["failureOverview", filters],
    queryFn: () => api.failureOverview(filters),
  });

  const { data: siteSummary, isLoading: sitesLoading } = useQuery({
    queryKey: ["siteFailureSummary", filters],
    queryFn: () => api.siteFailureSummary({ ...filters, limit: 100 }),
  });

  const { data: failuresData, isLoading: tasksLoading } = useQuery({
    queryKey: ["failedTasks", taskFilters],
    queryFn: () => api.failedTasks(taskFilters),
  });

  const { data: auditData } = useQuery({
    queryKey: ["siteAudit", selectedSite, filters],
    queryFn: () => api.siteAudit(selectedSite!, filters),
    enabled: !!selectedSite && view === "sites",
  });

  const failures = (failuresData?.failures ?? []) as FailedTask[];
  const sites = siteSummary?.sites ?? [];
  const siteCount = overview?.siteCount ?? sites.length;

  useEffect(() => {
    if (overview && overview.siteCount === 0 && overview.totalFailures > 0) {
      setView("tasks");
    }
  }, [overview?.siteCount, overview?.totalFailures]);

  const selectSite = (site: string | null) => {
    setSelectedSite(site);
    setFilters({ siteCode: site || undefined });
    if (site) setView("tasks");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatChip label="Failed tasks" value={overview?.totalFailures ?? "—"} tone="danger" />
        <StatChip label="Sites hit" value={siteCount} tone={siteCount ? "warn" : "default"} />
        <StatChip label="Pipelines" value={overview?.pipelineCount ?? "—"} />
        <StatChip label="Bronze" value={overview?.bronzeFailures ?? "—"} />
        <StatChip label="Silver" value={overview?.silverFailures ?? "—"} />
        <StatChip label="Gold" value={overview?.goldFailures ?? "—"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("sites")}
            className={`rounded-md px-3 py-1.5 ${view === "sites" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            By site ({siteCount})
          </button>
          <button
            type="button"
            onClick={() => setView("tasks")}
            className={`rounded-md px-3 py-1.5 ${view === "tasks" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            All failed tasks ({overview?.totalFailures ?? failures.length})
          </button>
        </div>

        {selectedSite && (
          <button
            type="button"
            onClick={() => selectSite(null)}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-white"
          >
            Clear site filter: {selectedSite} ×
          </button>
        )}
      </div>

      {view === "sites" ? (
        <section className="space-y-3">
          {sitesLoading ? (
            <p className="text-sm text-slate-400">Loading site summary…</p>
          ) : sites.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
              <p className="font-medium text-slate-300">No site-level failures in this date range</p>
              <p className="mt-1 text-xs leading-relaxed">
                Many Silver/Gold notebook failures have no <code className="text-slate-300">SiteCode</code>.
                Switch to <button type="button" className="text-sky-400 hover:underline" onClick={() => setView("tasks")}>All failed tasks</button> to review pipeline-level errors.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Database</th>
                    <th className="px-3 py-2 font-medium text-right">Failures</th>
                    <th className="px-3 py-2 font-medium text-right">Pipelines</th>
                    <th className="px-3 py-2 font-medium">Last failure</th>
                    <th className="px-3 py-2 font-medium">Example pipeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sites.map((site) => (
                    <tr
                      key={site.SiteCode}
                      className={`cursor-pointer hover:bg-slate-800/60 ${selectedSite === site.SiteCode ? "bg-sky-950/30" : ""}`}
                      onClick={() => selectSite(site.SiteCode)}
                    >
                      <td className="px-3 py-1.5 font-semibold text-sky-300">{site.SiteCode}</td>
                      <td className="px-3 py-1.5 text-slate-300">{site.DataBaseName || "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-red-300">{site.failure_count}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{site.pipeline_count}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{formatShortTime(site.last_failure)}</td>
                      <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-300" title={site.sample_pipeline}>
                        {site.sample_pipeline}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedSite && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Recent audit — {selectedSite}
                </h3>
                <button type="button" className="text-xs text-slate-500 hover:text-white" onClick={() => selectSite(null)}>
                  Close
                </button>
              </div>
              {(auditData?.audits?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">No audit rows for this site in range.</p>
              ) : (
                <div className="max-h-48 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-500">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">When</th>
                        <th className="px-2 py-1 text-left font-medium">Task</th>
                        <th className="px-2 py-1 text-left font-medium">Status</th>
                        <th className="px-2 py-1 text-right font-medium">Rows</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {auditData!.audits.map((row, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-2 py-1 text-slate-400">{formatShortTime(row.StartTime)}</td>
                          <td className="max-w-[180px] truncate px-2 py-1 text-slate-200" title={row.TaskName}>{row.TaskName}</td>
                          <td className="px-2 py-1"><StatusBadge status={row.Status} /></td>
                          <td className="px-2 py-1 text-right tabular-nums text-slate-300">{row.RowsWritten || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {tasksLoading ? (
            <p className="text-sm text-slate-400">Loading failed tasks…</p>
          ) : failures.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
              No failed tasks in this date range.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Pipeline</th>
                    <th className="px-3 py-2 font-medium">Layer</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Task</th>
                    <th className="px-3 py-2 font-medium">Error</th>
                    <th className="px-3 py-2 font-medium">Run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {failures.map((row) => {
                    const rowKey = `${row.TaskId || row.PipelineRunId}-${row.StartTime}`;
                    const open = expandedId === rowKey;
                    return (
                      <Fragment key={rowKey}>
                        <tr
                          className="cursor-pointer hover:bg-slate-800/50"
                          onClick={() => setExpandedId(open ? null : rowKey)}
                        >
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{formatShortTime(row.StartTime)}</td>
                          <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-200" title={row.ConfigName}>
                            {row.ConfigName}
                          </td>
                          <td className="px-3 py-1.5">{row.TargetName ? <LayerBadge layer={row.TargetName} /> : "—"}</td>
                          <td className="px-3 py-1.5">
                            {row.SiteCode ? (
                              <button
                                type="button"
                                className="font-medium text-sky-300 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectSite(row.SiteCode);
                                  setView("sites");
                                }}
                              >
                                {row.SiteCode}
                              </button>
                            ) : (
                              <span className="text-slate-600" title="Pipeline-level failure (no site)">—</span>
                            )}
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-1.5 text-slate-300" title={row.TaskName}>
                            {row.TaskName}
                          </td>
                          <td className="max-w-[240px] truncate px-3 py-1.5 text-red-200/80" title={row.ErrorMessage}>
                            {row.ErrorMessage || "—"}
                          </td>
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <Link
                                to={`/runs?pipelineRunId=${encodeURIComponent(row.PipelineRunId)}`}
                                className="text-sky-400 hover:underline"
                              >
                                Open
                              </Link>
                              <FabricLink url={row.fabricUrl} meta={rowToRunMeta(row as unknown as Record<string, string>)} label="Fabric" />
                            </span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-950/70">
                            <td colSpan={7} className="px-3 py-2">
                              <div className="grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
                                <p><span className="text-slate-500">Database:</span> {row.DataBaseName || "—"}</p>
                                <p><span className="text-slate-500">Site name:</span> {row.SiteName || "—"}</p>
                                <p><span className="text-slate-500">Target table:</span> {row.TargetTable || "—"}</p>
                                <p><span className="text-slate-500">Status:</span> <StatusBadge status={row.Status} /></p>
                                <p className="sm:col-span-2 whitespace-pre-wrap break-words text-red-200/90">
                                  <span className="text-slate-500">Error: </span>
                                  {row.ErrorMessage || "No error message"}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
