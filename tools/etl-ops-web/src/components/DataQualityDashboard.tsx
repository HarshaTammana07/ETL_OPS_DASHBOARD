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
import type { DqIssueRow } from "./DataQualityDrawer";

const chartTooltip = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };

type KpiId = "issues" | "failed" | "tables" | "pipelines";
type ChartId = "topTables" | "byPipeline" | "dailyTrend";

interface Overview {
  totalIssues: number;
  failedCount: number;
  zeroRowsCount: number;
  tableCount: number;
  pipelineCount: number;
  nullIssues: number;
  duplicateIssues: number;
}

interface DataQualityDashboardProps {
  overview?: Overview;
  issues: DqIssueRow[];
  isLoading?: boolean;
  onSelectIssue?: (issue: DqIssueRow) => void;
}

const PIPELINE_COLORS = ["#f97316", "#eab308", "#22c55e", "#38bdf8", "#a78bfa", "#64748b"];

function shortTable(name: string): string {
  const stripped = name.replace(/^br[_z]?_/i, "").replace(/^slv_/i, "").trim();
  return stripped || name;
}

function shortPipeline(name: string): string {
  return name.replace(/\s+Bronze.*$/i, "").replace(/\s+Pipeline$/i, "").replace(/\s+Gold.*$/i, "").trim() || name;
}

function yAxisWidth(labels: string[], enlarged: boolean): number {
  const maxLen = Math.max(...labels.map((l) => l.length), 4);
  return Math.min(enlarged ? 180 : 120, Math.max(enlarged ? 100 : 80, Math.ceil(maxLen * 6.2)));
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
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
            Close ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const CHART_BODY_MIN_H = "min-h-[172px]";

function ChartPanel({
  title,
  subtitle,
  onExpand,
  children,
  centerContent = false,
}: {
  title: string;
  subtitle: string;
  onExpand: () => void;
  children: ReactNode;
  centerContent?: boolean;
}) {
  return (
    <div className="group relative flex flex-col rounded-lg border border-slate-800 bg-slate-900/50 p-2">
      <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
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
      <button
        type="button"
        onClick={onExpand}
        className={clsx(
          "flex w-full flex-1 text-left",
          CHART_BODY_MIN_H,
          centerContent ? "flex-col justify-center" : "flex-col justify-start",
        )}
        title="Click to enlarge"
      >
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
  accent: "red" | "amber" | "sky" | "violet";
  expanded: boolean;
  onToggle: (id: KpiId) => void;
}) {
  const accents = {
    red: { base: "from-red-500/15 to-red-950/30 border-red-500/25", active: "from-red-500/25 to-red-950/45 border-red-400/50 ring-1 ring-red-500/30", value: "text-red-100" },
    amber: { base: "from-amber-500/10 to-amber-950/25 border-amber-500/25", active: "from-amber-500/20 to-amber-950/35 border-amber-400/50 ring-1 ring-amber-500/30", value: "text-amber-100" },
    sky: { base: "from-sky-500/10 to-sky-950/25 border-sky-500/25", active: "from-sky-500/20 to-sky-950/35 border-sky-400/50 ring-1 ring-sky-500/30", value: "text-sky-100" },
    violet: { base: "from-violet-500/10 to-violet-950/25 border-violet-500/25", active: "from-violet-500/20 to-violet-950/35 border-violet-400/50 ring-1 ring-violet-500/30", value: "text-violet-100" },
  };
  const tone = accents[accent];

  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={clsx(
        "min-h-[4.75rem] rounded-lg border bg-gradient-to-br px-2.5 py-2 text-left transition hover:brightness-110",
        expanded ? tone.active : tone.base,
      )}
      title={sub ? `${label}: ${value} — ${sub}` : `${label}: ${value}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className="shrink-0 text-[9px] text-slate-600">{expanded ? "▲" : "▼"}</span>
      </div>
      <p className={clsx("text-lg font-bold tabular-nums leading-tight", tone.value)}>{value}</p>
      {sub && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500" title={sub}>
          {sub}
        </p>
      )}
    </button>
  );
}

export function DataQualityDashboard({ overview, issues, isLoading, onSelectIssue }: DataQualityDashboardProps) {
  const [expandedKpi, setExpandedKpi] = useState<KpiId | null>(null);
  const [theaterChart, setTheaterChart] = useState<ChartId | null>(null);

  const toggleKpi = (id: KpiId) => setExpandedKpi((prev) => (prev === id ? null : id));

  const topTables = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of issues) {
      const name = i.TableName || "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name: shortTable(name), fullName: name, count }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  const byPipeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of issues) {
      const name = i.ConfigName || "Unknown pipeline";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const i of issues) {
      if (!i.CreatedAt) continue;
      const day = i.CreatedAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, issueCount]) => ({ date: date.slice(5).replace("-", "/"), fullDate: date, issueCount }));
  }, [issues]);

  const pieData = byPipeline.map((p, i) => ({
    name: shortPipeline(p.name),
    fullName: p.name,
    value: p.count,
    fill: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
  }));

  const topTablesChart = (height: number, limit = 8) => {
    const slice = topTables.slice(0, limit);
    const enlarged = height > 200;
    const axisW = yAxisWidth(slice.map((t) => t.name), enlarged);
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={slice} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: enlarged ? 12 : 9 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: enlarged ? 11 : 9 }}
            width={axisW}
            tickLine={false}
          />
          <Tooltip
            contentStyle={chartTooltip}
            formatter={(value: number) => [value, "Issues"]}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
          />
          <Bar dataKey="count" fill="#f87171" radius={[0, 4, 4, 0]} name="Issues" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const pipelineChart = (height: number, showLegend = false) => (
    <div className={showLegend ? "flex flex-col gap-4 sm:flex-row sm:items-center" : ""}>
      <ResponsiveContainer width="100%" height={height} className={showLegend ? "sm:max-w-[320px]" : ""}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={showLegend ? "45%" : "50%"} outerRadius={showLegend ? "75%" : "70%"} paddingAngle={2}>
            {pieData.map((entry) => (
              <Cell key={entry.fullName} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={chartTooltip}
            formatter={(value: number, _name, item) => [value, item.payload.fullName ?? "Issues"]}
          />
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <ul className="min-w-0 flex-1 space-y-1.5">
          {pieData.map((p) => (
            <li key={p.fullName} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate text-slate-300" title={p.fullName}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.fill }} />
                <span className="truncate">{p.fullName}</span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-red-300">{p.value}</span>
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
        <XAxis dataKey={useFullDate ? "fullDate" : "date"} tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} tickFormatter={useFullDate ? (v) => String(v).slice(5) : undefined} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} allowDecimals={false} width={height > 200 ? 36 : 24} />
        <Tooltip contentStyle={chartTooltip} />
        <Line type="monotone" dataKey="issueCount" stroke="#f87171" strokeWidth={height > 200 ? 3 : 2} dot={{ fill: "#f87171", r: height > 200 ? 4 : 2 }} name="Issues" />
      </LineChart>
    </ResponsiveContainer>
  );

  if (isLoading) return <p className="text-xs text-slate-500">Loading dashboard…</p>;

  const total = overview?.totalIssues ?? 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <ExpandableKpi id="issues" label="DQ issues" value={total} sub={overview?.duplicateIssues ? `${overview.duplicateIssues} with dupes` : "Non-pass validations"} accent="red" expanded={expandedKpi === "issues"} onToggle={toggleKpi} />
        <ExpandableKpi id="failed" label="Failed" value={overview?.failedCount ?? 0} sub={overview?.zeroRowsCount ? `${overview.zeroRowsCount} zero-row` : "Validation failed"} accent="amber" expanded={expandedKpi === "failed"} onToggle={toggleKpi} />
        <ExpandableKpi id="tables" label="Tables" value={overview?.tableCount ?? 0} sub="Distinct tables" accent="sky" expanded={expandedKpi === "tables"} onToggle={toggleKpi} />
        <ExpandableKpi id="pipelines" label="Pipelines" value={overview?.pipelineCount ?? 0} sub={overview?.nullIssues ? `${overview.nullIssues} null issues` : "With DQ failures"} accent="violet" expanded={expandedKpi === "pipelines"} onToggle={toggleKpi} />
      </div>

      <div className="grid gap-1.5 lg:grid-cols-3">
        <ChartPanel title="Top tables" subtitle="Most validation issues" onExpand={() => setTheaterChart("topTables")}>
          {topTables.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">No issues in window</p> : topTablesChart(136, 6)}
        </ChartPanel>
        <ChartPanel title="By pipeline" subtitle="Issue share by config" onExpand={() => setTheaterChart("byPipeline")}>
          {pieData.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            <div className="flex flex-col justify-center">
              {pipelineChart(72)}
              <ul className="mt-0.5 space-y-0.5 overflow-hidden">
                {pieData.slice(0, 5).map((p) => (
                  <li key={p.fullName} className="flex justify-between gap-1 text-[10px] leading-tight">
                    <span className="flex min-w-0 items-center gap-1 text-slate-400" title={p.fullName}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.fill }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-300">{p.value}</span>
                  </li>
                ))}
                {pieData.length > 5 && (
                  <li className="text-[9px] text-slate-600">+{pieData.length - 5} more — expand chart</li>
                )}
              </ul>
            </div>
          )}
        </ChartPanel>
        <ChartPanel title="Daily trend" subtitle="Issues per day" onExpand={() => setTheaterChart("dailyTrend")} centerContent>
          {dailyTrend.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">No data</p> : trendChart(120)}
        </ChartPanel>
      </div>

      {expandedKpi && (
        <div className="rounded-lg border border-sky-500/20 bg-slate-900/60 p-2.5">
          {expandedKpi === "issues" && (
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded border border-slate-800 px-2 py-1.5"><p className="text-[9px] text-slate-500">Total</p><p className="font-bold text-red-300">{total}</p></div>
              <div className="rounded border border-slate-800 px-2 py-1.5"><p className="text-[9px] text-slate-500">Duplicates</p><p className="font-bold text-amber-300">{overview?.duplicateIssues ?? 0}</p></div>
              <div className="rounded border border-slate-800 px-2 py-1.5"><p className="text-[9px] text-slate-500">Nulls</p><p className="font-bold text-sky-300">{overview?.nullIssues ?? 0}</p></div>
            </div>
          )}
          {expandedKpi === "failed" && (
            <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
              {issues.filter((i) => i.ValidationStatus === "FAILED").slice(0, 30).map((i) => (
                <li key={`${i.DqId}-${i.CreatedAt}`} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                  <button type="button" className="truncate text-left text-sky-300 hover:underline" onClick={() => onSelectIssue?.(i)}>{i.TableName}</button>
                  <span className="shrink-0 text-red-300">{i.ValidationStatus}</span>
                </li>
              ))}
            </ul>
          )}
          {expandedKpi === "tables" && (
            <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
              {topTables.map((t) => (
                <li key={t.fullName} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                  <span className="truncate text-slate-300" title={t.fullName}>{t.fullName}</span>
                  <span className="tabular-nums text-red-300">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
          {expandedKpi === "pipelines" && (
            <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
              {byPipeline.map((p) => (
                <li key={p.name} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                  <span className="truncate text-slate-300" title={p.name}>{p.name}</span>
                  <span className="tabular-nums text-red-300">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ChartTheater
        title={theaterChart === "topTables" ? "Top tables" : theaterChart === "byPipeline" ? "By pipeline" : "Daily trend"}
        subtitle="Enlarged view — Esc or click outside to close"
        open={theaterChart !== null}
        onClose={() => setTheaterChart(null)}
      >
        {theaterChart === "topTables" && topTablesChart(Math.min(480, 40 + topTables.length * 28), topTables.length)}
        {theaterChart === "byPipeline" && pipelineChart(360, true)}
        {theaterChart === "dailyTrend" && trendChart(400, true)}
      </ChartTheater>
    </div>
  );
}
