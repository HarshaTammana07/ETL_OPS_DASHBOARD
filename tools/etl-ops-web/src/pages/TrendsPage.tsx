import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { fabricLinkColumn } from "../components/FabricLink";
import { LayerBadge, StatusBadge } from "../components/StatusBadge";
import { isRunScoped, TrendsScopeBar } from "../components/TrendsScopeBar";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import type { RunScopeContext } from "../types";

type TrendsTab = "reliability" | "task-activity";

const chartTooltipStyle = { background: "#0f172a", border: "1px solid #334155" };

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

function formatCompact(n: number | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
      }
    >
      {children}
    </button>
  );
}

function ChartHint({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] text-slate-500">{children}</p>;
}

function CompactKpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/5"
        : tone === "danger"
          ? "border-red-500/40 bg-red-500/5"
          : "border-slate-700 bg-slate-900/50";

  const valueClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-red-400"
          : "text-slate-100";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}

function RunScopePanel({ runScope }: { runScope: RunScopeContext }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-lg border border-sky-800/40 bg-sky-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-sky-950/40"
      >
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-100">Single-run analysis</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {runScope.layerCount} layer(s)
            {runScope.startTime ? ` · ${runScope.startTime.slice(0, 19).replace("T", " ")}` : ""}
          </p>
        </div>
        <span className="text-slate-500">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
      <div className="border-t border-sky-900/50 px-3 pb-3">
      {runScope.configNames.length > 0 && (
        <p className="mt-2 text-xs text-slate-300">{runScope.configNames.join(" · ")}</p>
      )}
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Layer</th>
              <th className="px-3 py-2 font-medium">Pipeline</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Failed tasks</th>
              <th className="px-3 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {runScope.layers.map((layer) => (
              <tr key={layer.RunId} className="hover:bg-slate-900/50">
                <td className="px-3 py-1.5">{layer.TargetName ? <LayerBadge layer={layer.TargetName} /> : "—"}</td>
                <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-200" title={layer.ConfigName}>
                  {layer.ConfigName}
                </td>
                <td className="px-3 py-1.5">
                  <StatusBadge status={layer.Status} />
                </td>
                <td className="px-3 py-1.5 tabular-nums text-slate-300">{layer.FailedTasks ?? "0"}</td>
                <td className="px-3 py-1.5 text-slate-400">
                  {formatDuration(
                    layer.StartTime && layer.EndTime
                      ? (new Date(layer.EndTime).getTime() - new Date(layer.StartTime).getTime()) / 1000
                      : null,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      )}
    </section>
  );
}

export function TrendsPage() {
  const { filters, setFilters } = useOutletContext<FilterContext>();
  const [tab, setTab] = useState<TrendsTab>("reliability");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);
  const runScoped = isRunScoped(filters);
  const scopeHint = runScoped ? "Scoped to selected run" : dateLabel;

  const { data: reliability, isLoading: relLoading } = useQuery({
    queryKey: ["trendsReliability", filters],
    queryFn: () => api.reliabilityTrends({ ...filters, topLimit: 10 }),
    enabled: tab === "reliability" || runScoped,
  });

  const { data: taskActivity, isLoading: taskLoading } = useQuery({
    queryKey: ["trendsTaskActivity", filters],
    queryFn: () => api.taskActivityTrends({ ...filters, topLimit: 10 }),
    enabled: tab === "task-activity" || runScoped,
  });

  const dayFilters = useMemo(
    () =>
      selectedDay
        ? {
            ...filters,
            startDateFrom: selectedDay,
            startDateTo: selectedDay,
            refDate: undefined,
            lookbackDays: undefined,
          }
        : null,
    [filters, selectedDay],
  );

  // Top failing pipelines list should stay complete even after clicking a row.
  // The main reliability query is filtered by configName, so it would collapse
  // to a single row — fetch an unfiltered copy (dates kept, pipeline ignored).
  const topPipelinesFilters = useMemo(
    () => ({
      ...filters,
      configName: undefined,
    }),
    [filters],
  );

  const { data: topFailingAll } = useQuery({
    queryKey: ["trendsTopFailures", topPipelinesFilters],
    queryFn: () => api.topFailures({ ...topPipelinesFilters, limit: 10 }),
    enabled: tab === "reliability" && !runScoped,
  });

  const topPipelines = topFailingAll?.items ?? reliability?.topFailingPipelines ?? [];

  const togglePipelineFilter = (configName: string) => {
    if (filters.configName === configName) {
      setFilters({ configName: undefined });
    } else {
      setFilters({ configName });
    }
  };

  // Same problem for sites: keep full top-sites list so users can switch sites
  // without clearing first.
  const topSitesFilters = useMemo(
    () => ({
      ...filters,
      siteCode: undefined,
    }),
    [filters],
  );

  const { data: topSitesAll } = useQuery({
    queryKey: ["trendsTopSites", topSitesFilters],
    queryFn: () => api.taskActivityTrends({ ...topSitesFilters, topLimit: 10 }),
    enabled: tab === "task-activity" && !runScoped,
  });

  const topSites = topSitesAll?.topFailingSites ?? taskActivity?.topFailingSites ?? [];

  const toggleSiteFilter = (siteCode: string) => {
    if (filters.siteCode === siteCode) {
      setFilters({ siteCode: undefined });
    } else {
      setFilters({ siteCode });
    }
  };

  const { data: dayRuns } = useQuery({
    queryKey: ["trendsDayRuns", dayFilters],
    queryFn: () => api.recentRuns({ ...dayFilters!, status: "FAILED", limit: 25, offset: 0 }),
    enabled: tab === "reliability" && !!dayFilters,
  });

  const { data: dayFailures } = useQuery({
    queryKey: ["trendsDayFailures", dayFilters],
    queryFn: () => api.failedTasks({ ...dayFilters!, limit: 25 }),
    enabled: tab === "task-activity" && !!dayFilters,
  });

  const selectDay = (day: string) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  };

  const runScope = reliability?.runScope ?? taskActivity?.runScope ?? null;
  const runScopeMissing =
    runScoped && !relLoading && !taskLoading && (reliability !== undefined || taskActivity !== undefined) && !runScope;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Trends</h2>
          <p className="text-[11px] text-slate-500">
            {runScoped ? "Run-scoped analysis" : dateLabel ? `Window: ${dateLabel}` : "Select a date window above"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TabButton
            active={tab === "reliability"}
            onClick={() => {
              setTab("reliability");
              setSelectedDay(null);
            }}
          >
            Run reliability
          </TabButton>
          <TabButton
            active={tab === "task-activity"}
            onClick={() => {
              setTab("task-activity");
              setSelectedDay(null);
            }}
          >
            Task activity
          </TabButton>
        </div>
      </div>

      {tab === "reliability" && (
        <>
          {relLoading && <p className="text-sm text-slate-400">Loading KPIs…</p>}
          {reliability && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <CompactKpi label="Pipeline runs" value={reliability.summary.totalRuns} hint={scopeHint} />
              <CompactKpi
                label="Success rate"
                value={`${reliability.summary.successPct}%`}
                tone="success"
                hint={`${reliability.summary.successRuns} succeeded`}
              />
              <CompactKpi
                label="Failed runs"
                value={reliability.summary.failedRuns}
                tone={reliability.summary.failedRuns ? "danger" : "default"}
                hint={`${reliability.summary.failedPct}% of runs`}
              />
              <CompactKpi
                label="Avg duration"
                value={formatDuration(reliability.summary.avgDurationSec)}
                hint="Completed runs"
              />
              <CompactKpi
                label="Retried runs"
                value={reliability.summary.retriedRuns}
                tone={reliability.summary.retriedRuns ? "warning" : "default"}
                hint="Attempt ≥ 2"
              />
            </div>
          )}
        </>
      )}

      {tab === "task-activity" && (
        <>
          {taskLoading && <p className="text-sm text-slate-400">Loading KPIs…</p>}
          {taskActivity && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <CompactKpi label="Task executions" value={formatCompact(taskActivity.summary.totalTasks)} hint={scopeHint} />
              <CompactKpi
                label="Failed tasks"
                value={formatCompact(taskActivity.summary.failedTasks)}
                tone={taskActivity.summary.failedTasks ? "danger" : "default"}
                hint={`${taskActivity.summary.failedTaskPct}% of tasks`}
              />
              <CompactKpi
                label="Rows written"
                value={formatCompact(taskActivity.summary.rowsWritten)}
                hint={`${formatCompact(taskActivity.summary.rowsRead)} read`}
              />
              <CompactKpi label="Successful tasks" value={formatCompact(taskActivity.summary.successTasks)} tone="success" />
              <CompactKpi
                label="Failing sites"
                value={taskActivity.summary.failingSites}
                tone={taskActivity.summary.failingSites ? "warning" : "default"}
                hint="Sites with failures"
              />
            </div>
          )}
        </>
      )}

      <TrendsScopeBar filters={filters} setFilters={setFilters} />

      {runScopeMissing && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          No pipeline runs matched this run ID. Check the Pipeline Run ID or Run ID and try again.
        </div>
      )}

      {runScope && <RunScopePanel runScope={runScope} />}

      {tab === "reliability" && (
        <div className="space-y-4">
          {reliability && (
            <>

              <section>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Outcomes by day
                </h3>
                <ChartHint>
                  {runScoped
                    ? "Daily breakdown for this run scope (often a single day)."
                    : "Click a day to inspect failed pipeline runs below."}
                </ChartHint>
                <div className="h-60 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={reliability.daily}
                      onClick={(state) => {
                        const day = (state?.activePayload?.[0]?.payload as { runDate?: string } | undefined)?.runDate;
                        if (day) selectDay(day);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="runDate" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Bar dataKey="successRuns" name="Success" fill="#10b981" stackId="a" cursor="pointer" />
                      <Bar dataKey="failedRuns" name="Failed" fill="#ef4444" stackId="a" cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Success rate %</h3>
                  <div className="h-52 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reliability.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="runDate" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Line type="monotone" dataKey="successPct" name="Success %" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Failures by layer
                  </h3>
                  <div className="h-52 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reliability.failuresByLayer}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="layer" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="failedRuns" name="Failed runs" fill="#f87171" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <section>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Average duration by layer
                </h3>
                <ChartHint>Hover for exact values (seconds). Bronze is typically longest.</ChartHint>
                <div className="h-56 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reliability.durationDaily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="runDate" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(v) => formatDuration(Number(v))}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => formatDuration(typeof value === "number" ? value : Number(value))}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="BR" name="Bronze" stroke="#f59e0b" strokeWidth={2} connectNulls dot={false} />
                      <Line type="monotone" dataKey="SL" name="Silver" stroke="#38bdf8" strokeWidth={2} connectNulls dot={false} />
                      <Line type="monotone" dataKey="GL" name="Gold" stroke="#a78bfa" strokeWidth={2} connectNulls dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {reliability.durationByLayer.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reliability.durationByLayer.map((row) => (
                      <div key={row.layer} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                        <span className="text-slate-400">{row.layer}</span>{" "}
                        <span className="font-medium text-slate-100">{formatDuration(row.avgDurationSec)}</span>
                        <span className="text-slate-500"> · {row.runCount} runs</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {!runScoped && (
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Top failing pipelines
                    {filters.configName && (
                      <span className="ml-2 rounded-full border border-sky-700 bg-sky-950/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-sky-200">
                        Filtered: {filters.configName}
                      </span>
                    )}
                  </h3>
                  {filters.configName && (
                    <button
                      type="button"
                      onClick={() => setFilters({ configName: undefined })}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      ✕ Show all pipelines
                    </button>
                  )}
                </div>
                <ChartHint>
                  Click a pipeline to filter the dashboard — click again to deselect. Use “Show all
                  pipelines” to reset without leaving this page.
                </ChartHint>
                <DataTable
                  rows={topPipelines.map((i) => ({
                    ConfigName: i.ConfigName,
                    failure_count: String(i.failure_count),
                  }))}
                  emptyMessage="No failures in the selected window"
                  columns={[
                    {
                      key: "ConfigName",
                      label: "Pipeline",
                      render: (v) => {
                        const selected = filters.configName === v;
                        return (
                          <button
                            type="button"
                            className={
                              selected
                                ? "text-left font-semibold text-sky-200"
                                : "text-left text-sky-300 hover:underline"
                            }
                            onClick={() => togglePipelineFilter(v)}
                            title={selected ? "Click to clear pipeline filter" : "Filter dashboard to this pipeline"}
                          >
                            {selected ? `✓ ${v}` : v}
                          </button>
                        );
                      },
                    },
                    { key: "failure_count", label: "Failed runs" },
                  ]}
                />
              </section>
              )}

              {!runScoped && selectedDay && (
                <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Failed runs on {selectedDay}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear selection
                    </button>
                  </div>
                  <DataTable
                    rows={(dayRuns?.runs ?? []) as unknown as Record<string, string>[]}
                    emptyMessage={`No failed pipeline runs on ${selectedDay}`}
                    columns={[
                      { key: "ConfigName", label: "Pipeline" },
                      { key: "TargetName", label: "Layer", render: (v) => <LayerBadge layer={v} /> },
                      { key: "Status", label: "Status", render: (v) => <StatusBadge status={v} /> },
                      { key: "StartTime", label: "Start" },
                      { key: "FailedTasks", label: "Failed tasks" },
                      fabricLinkColumn(),
                    ]}
                  />
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === "task-activity" && (
        <div className="space-y-4">
          {taskActivity && (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
              <section>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Failed tasks by day
                </h3>
                <ChartHint>
                  {runScoped
                    ? "Task outcomes for this run scope."
                    : "Click a day to inspect task-level failures below."}
                </ChartHint>
                <div className="h-60 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={taskActivity.daily}
                      onClick={(state) => {
                        const day = (state?.activePayload?.[0]?.payload as { runDate?: string } | undefined)?.runDate;
                        if (day) selectDay(day);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="runDate" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Bar dataKey="successTasks" name="Success" fill="#10b981" stackId="a" cursor="pointer" />
                      <Bar dataKey="failedTasks" name="Failed" fill="#ef4444" stackId="a" cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Throughput — rows written
                </h3>
                <ChartHint>Hover for daily volume. Large drops can indicate incomplete loads.</ChartHint>
                <div className="h-56 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={taskActivity.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="runDate" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => formatCompact(typeof value === "number" ? value : Number(value))}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="rowsWritten" name="Rows written" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="rowsRead" name="Rows read" stroke="#64748b" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              </div>

              <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Top failing sites
                    {filters.siteCode && (
                      <span className="ml-2 rounded-full border border-sky-700 bg-sky-950/60 px-2 py-0.5 text-[10px] normal-case tracking-normal text-sky-200">
                        Filtered: {filters.siteCode}
                      </span>
                    )}
                  </h3>
                  {filters.siteCode && (
                    <button
                      type="button"
                      onClick={() => setFilters({ siteCode: undefined })}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      ✕ Show all sites
                    </button>
                  )}
                </div>
                <DataTable
                  rows={topSites.map((s) => ({
                    SiteCode: s.SiteCode,
                    failureCount: String(s.failureCount),
                    pipelineCount: String(s.pipelineCount),
                    lastFailure: s.lastFailure,
                  }))}
                  emptyMessage="No site-level task failures in the selected window"
                  columns={[
                    {
                      key: "SiteCode",
                      label: "Site",
                      render: (v) => {
                        const selected = filters.siteCode === v;
                        return (
                          <button
                            type="button"
                            className={
                              selected
                                ? "font-semibold text-sky-200"
                                : "font-medium text-sky-300 hover:underline"
                            }
                            onClick={() => toggleSiteFilter(v)}
                            title={selected ? "Click to clear site filter" : "Filter to this site (stays on Trends)"}
                          >
                            {selected ? `✓ ${v}` : v}
                          </button>
                        );
                      },
                    },
                    { key: "failureCount", label: "Failed tasks" },
                    { key: "pipelineCount", label: "Pipelines" },
                    { key: "lastFailure", label: "Last failure" },
                  ]}
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Click a site to filter — click again to deselect. Open{" "}
                  <Link to="/failures" className="text-sky-400 hover:underline">
                    Site Failures
                  </Link>{" "}
                  for the full list.
                </p>
              </section>

              {!runScoped && selectedDay && (
                <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Failed tasks on {selectedDay}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear selection
                    </button>
                  </div>
                  <DataTable
                    rows={(dayFailures?.failures ?? []) as unknown as Record<string, string>[]}
                    emptyMessage={`No failed tasks on ${selectedDay}`}
                    columns={[
                      { key: "ConfigName", label: "Pipeline" },
                      { key: "TargetName", label: "Layer", render: (v) => (v ? <LayerBadge layer={v} /> : "—") },
                      { key: "SiteCode", label: "Site" },
                      { key: "TaskName", label: "Task" },
                      {
                        key: "ErrorMessage",
                        label: "Error",
                        render: (v) => (
                          <span className="block max-w-xs truncate text-red-200/80" title={v}>
                            {v || "—"}
                          </span>
                        ),
                      },
                      fabricLinkColumn(),
                    ]}
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Showing up to 25 failures — open{" "}
                    <Link to="/failures" className="text-sky-400 hover:underline">
                      Site Failures
                    </Link>{" "}
                    for the full list.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
