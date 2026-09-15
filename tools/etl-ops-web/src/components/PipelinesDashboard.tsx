import clsx from "clsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PipelineRun } from "../types";
import type { PipelineCatalogRow } from "./PipelineDrawers";

const chartTooltip = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };
const LAYER_COLORS: Record<string, string> = { BR: "#d97706", SL: "#38bdf8", GL: "#a78bfa" };
type KpiId = "configs" | "active" | "runs" | "failed";
type ChartId = "topPipelines" | "byLayer" | "dailyTrend";

interface CatalogRow {
  ConfigName?: string;
  TargetName?: string;
  SourceSystem?: string;
  IsActive?: string;
  runs_in_window?: string | number;
  failed_runs?: string | number;
}

interface PipelinesDashboardProps {
  catalog: CatalogRow[];
  runs: PipelineRun[];
  isLoading?: boolean;
  onSelectConfig?: (row: PipelineCatalogRow) => void;
}

function shortPipeline(name: string): string {
  return name.replace(/\s+Bronze.*$/i, "").replace(/\s+Pipeline$/i, "").trim() || name;
}

function isActive(value?: string): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" />
    </svg>
  );
}

function ChartTheater({ title, subtitle, open, onClose, children }: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-950 shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function ChartPanel({
  title,
  subtitle,
  onExpand,
  children,
}: {
  title: string;
  subtitle: string;
  onExpand: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group relative rounded-lg border border-slate-800 bg-slate-900/50 p-2">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400 opacity-80 transition hover:border-sky-600 hover:text-sky-300 group-hover:opacity-100"
          title="Enlarge chart"
        >
          <ExpandIcon />
          <span className="hidden sm:inline">Expand</span>
        </button>
      </div>
      <button type="button" onClick={onExpand} className="block w-full text-left" title="Click to enlarge">
        {children}
      </button>
    </div>
  );
}

function ExpandableKpi({
  id,
  label,
  value,
  sub,
  accent,
  expanded,
  onToggle,
}: {
  id: KpiId;
  label: string;
  value: string | number;
  sub?: string;
  accent: "sky" | "emerald" | "amber" | "red";
  expanded: boolean;
  onToggle: (id: KpiId) => void;
}) {
  const accents = {
    sky: {
      base: "from-sky-500/10 to-sky-950/25 border-sky-500/25",
      active: "from-sky-500/20 to-sky-950/35 border-sky-400/50 ring-1 ring-sky-500/30",
      value: "text-sky-100",
    },
    emerald: {
      base: "from-emerald-500/10 to-emerald-950/25 border-emerald-500/25",
      active: "from-emerald-500/20 to-emerald-950/35 border-emerald-400/50 ring-1 ring-emerald-500/30",
      value: "text-emerald-100",
    },
    amber: {
      base: "from-amber-500/10 to-amber-950/25 border-amber-500/25",
      active: "from-amber-500/20 to-amber-950/35 border-amber-400/50 ring-1 ring-amber-500/30",
      value: "text-amber-100",
    },
    red: {
      base: "from-red-500/15 to-red-950/30 border-red-500/25",
      active: "from-red-500/25 to-red-950/45 border-red-400/50 ring-1 ring-red-500/30",
      value: "text-red-100",
    },
  };
  const tone = accents[accent];

  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={clsx(
        "rounded-lg border bg-gradient-to-br px-2 py-1.5 text-left transition hover:brightness-110",
        expanded ? tone.active : tone.base,
      )}
      title="Click for more detail"
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className="text-[9px] text-slate-600">{expanded ? "▲" : "▼"}</span>
      </div>
      <p className={clsx("text-lg font-bold tabular-nums leading-tight", tone.value)}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</p>}
    </button>
  );
}

function toCatalogRow(row: CatalogRow): PipelineCatalogRow {
  return {
    ConfigName: row.ConfigName || "",
    TargetName: row.TargetName,
    SourceSystem: row.SourceSystem,
    IsActive: row.IsActive,
    runs_in_window: row.runs_in_window,
    failed_runs: row.failed_runs,
  };
}

export function PipelinesDashboard({ catalog, runs, isLoading, onSelectConfig }: PipelinesDashboardProps) {
  const [expandedKpi, setExpandedKpi] = useState<KpiId | null>(null);
  const [theaterChart, setTheaterChart] = useState<ChartId | null>(null);

  const toggleKpi = (id: KpiId) => setExpandedKpi((prev) => (prev === id ? null : id));

  const stats = useMemo(() => {
    const totalConfigs = catalog.length;
    const activeRegistered = catalog.filter((r) => isActive(r.IsActive)).length;
    const withRuns = catalog.filter((r) => Number(r.runs_in_window || 0) > 0).length;
    const idle = totalConfigs - withRuns;
    const totalRuns = catalog.reduce((s, r) => s + Number(r.runs_in_window || 0), 0);
    const totalFailed = catalog.reduce((s, r) => s + Number(r.failed_runs || 0), 0);
    const failPct = totalRuns ? Math.round((totalFailed / totalRuns) * 100) : 0;
    return { totalConfigs, activeRegistered, withRuns, idle, totalRuns, totalFailed, failPct };
  }, [catalog]);

  const topPipelines = useMemo(
    () =>
      [...catalog]
        .filter((r) => Number(r.runs_in_window || 0) > 0)
        .sort((a, b) => Number(b.runs_in_window || 0) - Number(a.runs_in_window || 0))
        .map((r) => ({
          name: shortPipeline(r.ConfigName || "Unknown"),
          fullName: r.ConfigName || "Unknown",
          layer: r.TargetName || "—",
          runs: Number(r.runs_in_window || 0),
          failed: Number(r.failed_runs || 0),
          row: r,
        })),
    [catalog],
  );

  const byLayer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of catalog) {
      const layer = r.TargetName || "Other";
      counts.set(layer, (counts.get(layer) ?? 0) + Number(r.runs_in_window || 0));
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([layer, count]) => ({ layer, count, fill: LAYER_COLORS[layer] ?? "#64748b" }))
      .sort((a, b) => b.count - a.count);
  }, [catalog]);

  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of runs) {
      if (!r.StartTime) continue;
      const day = r.StartTime.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, runCount]) => ({
        date: date.slice(5).replace("-", "/"),
        fullDate: date,
        runCount,
      }));
  }, [runs]);

  const failedPipelines = useMemo(
    () => topPipelines.filter((p) => p.failed > 0).sort((a, b) => b.failed - a.failed),
    [topPipelines],
  );

  const layerBreakdown = useMemo(() => {
    const byLayerCount = new Map<string, number>();
    for (const r of catalog) {
      const layer = r.TargetName || "Other";
      byLayerCount.set(layer, (byLayerCount.get(layer) ?? 0) + 1);
    }
    return [...byLayerCount.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const idleConfigs = useMemo(
    () => catalog.filter((r) => Number(r.runs_in_window || 0) === 0).sort((a, b) => (a.ConfigName || "").localeCompare(b.ConfigName || "")),
    [catalog],
  );

  const topPipelinesChart = (height: number, limit = 8) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={topPipelines.slice(0, limit)} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} width={height > 200 ? 100 : 72} />
        <Tooltip contentStyle={chartTooltip} />
        <Bar dataKey="runs" fill="#38bdf8" radius={[0, 4, 4, 0]} name="Runs" />
      </BarChart>
    </ResponsiveContainer>
  );

  const layerChart = (height: number, showLegend = false) => (
    <div className={showLegend ? "flex flex-col gap-4 sm:flex-row sm:items-center" : ""}>
      <ResponsiveContainer width="100%" height={height} className={showLegend ? "sm:max-w-[320px]" : ""}>
        <PieChart>
          <Pie
            data={byLayer}
            dataKey="count"
            nameKey="layer"
            cx="50%"
            cy="50%"
            innerRadius={showLegend ? "45%" : "50%"}
            outerRadius={showLegend ? "75%" : "70%"}
            paddingAngle={2}
            label={showLegend ? ({ layer, percent }) => `${layer} ${((percent ?? 0) * 100).toFixed(0)}%` : false}
          >
            {byLayer.map((entry) => (
              <Cell key={entry.layer} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltip} />
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <ul className="min-w-0 flex-1 space-y-1.5">
          {byLayer.map((p) => (
            <li key={p.layer} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate text-slate-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.fill }} />
                {p.layer}
              </span>
              <span className="shrink-0 tabular-nums font-medium text-sky-300">{p.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const trendChart = (height: number, useFullDate = false) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={dailyTrend} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="#1e293b" />
        <XAxis
          dataKey={useFullDate ? "fullDate" : "date"}
          tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }}
          tickFormatter={useFullDate ? (v) => String(v).slice(5) : undefined}
        />
        <YAxis tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} allowDecimals={false} width={height > 200 ? 36 : 24} />
        <Tooltip contentStyle={chartTooltip} />
        <Line type="monotone" dataKey="runCount" stroke="#38bdf8" strokeWidth={height > 200 ? 3 : 2} dot={{ fill: "#38bdf8", r: height > 200 ? 4 : 2 }} name="Runs" />
      </LineChart>
    </ResponsiveContainer>
  );

  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <ExpandableKpi
          id="configs"
          label="Configs"
          value={stats.totalConfigs}
          sub={`${stats.activeRegistered} registered active`}
          accent="sky"
          expanded={expandedKpi === "configs"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="active"
          label="Ran in window"
          value={stats.withRuns}
          sub={`${stats.idle} idle`}
          accent="emerald"
          expanded={expandedKpi === "active"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="runs"
          label="Total runs"
          value={stats.totalRuns}
          sub="Layer runs in window"
          accent="amber"
          expanded={expandedKpi === "runs"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="failed"
          label="Failed runs"
          value={stats.totalFailed}
          sub={stats.totalRuns ? `${stats.failPct}% failure rate` : "No runs"}
          accent="red"
          expanded={expandedKpi === "failed"}
          onToggle={toggleKpi}
        />
      </div>

      <div className="grid gap-1.5 lg:grid-cols-3">
        <ChartPanel title="Top pipelines" subtitle="Most runs in window" onExpand={() => setTheaterChart("topPipelines")}>
          {topPipelines.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No runs in window</p>
          ) : (
            topPipelinesChart(120, 6)
          )}
        </ChartPanel>

        <ChartPanel title="By layer" subtitle="Run share BR / SL / GL" onExpand={() => setTheaterChart("byLayer")}>
          {byLayer.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            <>
              {layerChart(100)}
              <ul className="mt-0.5 space-y-0.5">
                {byLayer.slice(0, 3).map((p) => (
                  <li key={p.layer} className="flex justify-between text-[10px]">
                    <span className="flex items-center gap-1 truncate text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.fill }} />
                      {p.layer}
                    </span>
                    <span className="tabular-nums text-slate-300">{p.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel title="Daily trend" subtitle="Runs per day" onExpand={() => setTheaterChart("dailyTrend")}>
          {dailyTrend.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            trendChart(120)
          )}
        </ChartPanel>
      </div>

      {expandedKpi && (
        <div className="rounded-lg border border-sky-500/20 bg-slate-900/60 p-2.5">
          {expandedKpi === "configs" && (
            <>
              <h4 className="mb-2 text-xs font-semibold text-slate-300">Catalog breakdown</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">Total</p>
                  <p className="text-base font-bold text-sky-300">{stats.totalConfigs}</p>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">Active flag</p>
                  <p className="text-base font-bold text-emerald-300">{stats.activeRegistered}</p>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">Inactive flag</p>
                  <p className="text-base font-bold text-slate-300">{stats.totalConfigs - stats.activeRegistered}</p>
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {layerBreakdown.map(([layer, count]) => (
                  <li key={layer} className="rounded border border-slate-800 px-2 py-0.5 text-slate-400">
                    <span className="font-medium text-slate-300">{layer}</span> · {count}
                  </li>
                ))}
              </ul>
            </>
          )}
          {expandedKpi === "active" && (
            <>
              <h4 className="mb-2 text-xs font-semibold text-slate-300">
                Idle configs ({idleConfigs.length}) — no runs in selected window
              </h4>
              <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
                {idleConfigs.length === 0 ? (
                  <li className="text-slate-500">All configs ran at least once.</li>
                ) : (
                  idleConfigs.map((r) => (
                    <li key={`${r.ConfigName}-${r.TargetName}`} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                      <button
                        type="button"
                        className="truncate text-left text-sky-300 hover:underline"
                        onClick={() => onSelectConfig?.(toCatalogRow(r))}
                      >
                        {r.ConfigName}
                      </button>
                      <span className="shrink-0 text-slate-500">{r.TargetName}</span>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
          {expandedKpi === "runs" && (
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Total runs</p>
                <p className="font-bold text-amber-300">{stats.totalRuns}</p>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Successful (est.)</p>
                <p className="font-bold text-emerald-300">{Math.max(0, stats.totalRuns - stats.totalFailed)}</p>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Top pipeline</p>
                <p className="truncate font-bold text-sky-300" title={topPipelines[0]?.fullName}>
                  {topPipelines[0] ? `${topPipelines[0].name} (${topPipelines[0].runs})` : "—"}
                </p>
              </div>
            </div>
          )}
          {expandedKpi === "failed" && (
            <>
              <h4 className="mb-2 text-xs font-semibold text-slate-300">Pipelines with failures</h4>
              <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
                {failedPipelines.length === 0 ? (
                  <li className="text-slate-500">No failed runs in window.</li>
                ) : (
                  failedPipelines.map((p) => (
                    <li key={p.fullName} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                      <button
                        type="button"
                        className="truncate text-left text-sky-300 hover:underline"
                        title={p.fullName}
                        onClick={() => onSelectConfig?.(toCatalogRow(p.row))}
                      >
                        {p.fullName}
                      </button>
                      <span className="shrink-0 tabular-nums text-red-300">{p.failed}</span>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      )}

      <ChartTheater
        title={
          theaterChart === "topPipelines"
            ? "Top pipelines"
            : theaterChart === "byLayer"
              ? "By layer"
              : "Daily trend"
        }
        subtitle="Enlarged view — Esc or click outside to close"
        open={theaterChart !== null}
        onClose={() => setTheaterChart(null)}
      >
        {theaterChart === "topPipelines" && topPipelinesChart(Math.min(480, 40 + topPipelines.length * 28), topPipelines.length)}
        {theaterChart === "byLayer" && layerChart(360, true)}
        {theaterChart === "dailyTrend" && trendChart(400, true)}
      </ChartTheater>
    </div>
  );
}
