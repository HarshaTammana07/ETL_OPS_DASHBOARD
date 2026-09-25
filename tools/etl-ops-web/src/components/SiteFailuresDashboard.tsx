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

const chartTooltip = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };
const PIPELINE_COLORS = ["#f97316", "#eab308", "#22c55e", "#38bdf8", "#a78bfa", "#64748b"];

type KpiId = "failures" | "sites" | "avg" | "pipelines";
type ChartId = "topSites" | "byPipeline" | "dailyTrend";

interface Overview {
  totalFailures: number;
  siteCount: number;
  noSiteFailures: number;
  pipelineCount: number;
}

interface SiteRow {
  SiteCode: string;
  SiteName?: string;
  failure_count: number;
  pipeline_count?: number;
}

interface TaskRow {
  StartTime?: string;
  ConfigName?: string;
}

interface SiteFailuresDashboardProps {
  overview?: Overview;
  sites: SiteRow[];
  tasks: TaskRow[];
  isLoading?: boolean;
  onSelectSite?: (siteCode: string) => void;
}

function shortPipeline(name: string): string {
  return name.replace(/^SAMMS\s+/i, "").replace(/\s+Bronze.*$/i, "").replace(/\s+Pipeline$/i, "") || name;
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
  accent: "red" | "amber" | "sky" | "violet";
  expanded: boolean;
  onToggle: (id: KpiId) => void;
}) {
  const accents = {
    red: {
      base: "from-red-500/15 to-red-950/30 border-red-500/25",
      active: "from-red-500/25 to-red-950/45 border-red-400/50 ring-1 ring-red-500/30",
      value: "text-red-100",
    },
    amber: {
      base: "from-amber-500/10 to-amber-950/25 border-amber-500/25",
      active: "from-amber-500/20 to-amber-950/35 border-amber-400/50 ring-1 ring-amber-500/30",
      value: "text-amber-100",
    },
    sky: {
      base: "from-sky-500/10 to-sky-950/25 border-sky-500/25",
      active: "from-sky-500/20 to-sky-950/35 border-sky-400/50 ring-1 ring-sky-500/30",
      value: "text-sky-100",
    },
    violet: {
      base: "from-violet-500/10 to-violet-950/25 border-violet-500/25",
      active: "from-violet-500/20 to-violet-950/35 border-violet-400/50 ring-1 ring-violet-500/30",
      value: "text-violet-100",
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

import { TablePaginationBar } from "./TablePaginationBar";

export function SiteFailuresDashboard({
  overview,
  sites,
  tasks,
  isLoading,
  onSelectSite,
}: SiteFailuresDashboardProps) {
  const [expandedKpi, setExpandedKpi] = useState<KpiId | null>(null);
  const [theaterChart, setTheaterChart] = useState<ChartId | null>(null);
  const [siteKpiPage, setSiteKpiPage] = useState(1);
  const [siteKpiPageSize, setSiteKpiPageSize] = useState(10);
  const [siteKpiSearch, setSiteKpiSearch] = useState("");

  const toggleKpi = (id: KpiId) => setExpandedKpi((prev) => (prev === id ? null : id));

  const topSites = useMemo(
    () =>
      [...sites]
        .sort((a, b) => b.failure_count - a.failure_count)
        .map((s) => ({
          site: s.SiteCode,
          siteName: s.SiteName,
          failures: s.failure_count,
          pipelines: s.pipeline_count ?? 0,
        })),
    [sites],
  );

  const filteredTopSites = useMemo(() => {
    const q = siteKpiSearch.trim().toLowerCase();
    if (!q) return topSites;
    return topSites.filter(
      (s) =>
        s.site.toLowerCase().includes(q) ||
        (s.siteName || "").toLowerCase().includes(q)
    );
  }, [topSites, siteKpiSearch]);

  const isAllKpi = siteKpiPageSize === -1;
  const totalKpiPages = isAllKpi ? 1 : Math.max(1, Math.ceil(filteredTopSites.length / siteKpiPageSize));
  const safeKpiPage = Math.min(Math.max(siteKpiPage, 1), totalKpiPages);

  const pagedTopSites = useMemo(() => {
    if (isAllKpi) return filteredTopSites;
    const start = (safeKpiPage - 1) * siteKpiPageSize;
    return filteredTopSites.slice(start, start + siteKpiPageSize);
  }, [filteredTopSites, safeKpiPage, siteKpiPageSize, isAllKpi]);

  const byPipeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const name = t.ConfigName || "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name: shortPipeline(name), fullName: name, count }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const dailyTrend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const t of tasks) {
      if (!t.StartTime) continue;
      const day = t.StartTime.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, failures]) => ({
        date: date.slice(5).replace("-", "/"),
        fullDate: date,
        failures,
      }));
  }, [tasks]);

  const total = overview?.totalFailures ?? 0;
  const siteLinked = Math.max(0, total - (overview?.noSiteFailures ?? 0));
  const sitePct = total ? Math.round((siteLinked / total) * 100) : 0;
  const avgPerSite = overview?.siteCount ? (siteLinked / overview.siteCount).toFixed(1) : "—";

  const pieData = byPipeline.map((p, i) => ({
    name: p.name,
    value: p.count,
    fill: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
  }));

  const topSitesChart = (height: number, limit = 8) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={topSites.slice(0, limit)} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} allowDecimals={false} />
        <YAxis type="category" dataKey="site" tick={{ fill: "#94a3b8", fontSize: height > 200 ? 12 : 9 }} width={height > 200 ? 44 : 32} />
        <Tooltip contentStyle={chartTooltip} />
        <Bar dataKey="failures" fill="#f87171" radius={[0, 4, 4, 0]} name="Failures" />
      </BarChart>
    </ResponsiveContainer>
  );

  const pipelineChart = (height: number, showLegend = false) => (
    <div className={showLegend ? "flex flex-col gap-4 sm:flex-row sm:items-center" : ""}>
      <ResponsiveContainer width="100%" height={height} className={showLegend ? "sm:max-w-[320px]" : ""}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={showLegend ? "45%" : "50%"}
            outerRadius={showLegend ? "75%" : "70%"}
            paddingAngle={2}
            label={showLegend ? ({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : false}
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltip} />
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <ul className="min-w-0 flex-1 space-y-1.5">
          {byPipeline.map((p, i) => (
            <li key={p.fullName} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate text-slate-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIPELINE_COLORS[i % PIPELINE_COLORS.length] }} />
                <span className="truncate" title={p.fullName}>{p.fullName}</span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-red-300">{p.count}</span>
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
        <Line type="monotone" dataKey="failures" stroke="#38bdf8" strokeWidth={height > 200 ? 3 : 2} dot={{ fill: "#38bdf8", r: height > 200 ? 4 : 2 }} name="Failures" />
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
          id="failures"
          label="Bronze failures"
          value={total}
          sub="SAMMS Bronze"
          accent="red"
          expanded={expandedKpi === "failures"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="sites"
          label="Sites affected"
          value={overview?.siteCount ?? 0}
          sub={`${sitePct}% site-linked`}
          accent="amber"
          expanded={expandedKpi === "sites"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="avg"
          label="Avg / site"
          value={avgPerSite}
          sub="Per clinic"
          accent="sky"
          expanded={expandedKpi === "avg"}
          onToggle={toggleKpi}
        />
        <ExpandableKpi
          id="pipelines"
          label="Pipelines"
          value={overview?.pipelineCount ?? 0}
          sub={overview?.noSiteFailures ? `${overview.noSiteFailures} no site` : "With failures"}
          accent="violet"
          expanded={expandedKpi === "pipelines"}
          onToggle={toggleKpi}
        />
      </div>

      <div className="grid gap-1.5 lg:grid-cols-3">
        <ChartPanel title="Top sites" subtitle="Most Bronze failures" onExpand={() => setTheaterChart("topSites")}>
          {topSites.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            topSitesChart(120, 6)
          )}
        </ChartPanel>

        <ChartPanel title="By pipeline" subtitle="SAMMS Bronze share" onExpand={() => setTheaterChart("byPipeline")}>
          {pieData.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            <>
              {pipelineChart(100)}
              <ul className="mt-0.5 space-y-0.5">
                {byPipeline.slice(0, 3).map((p, i) => (
                  <li key={p.fullName} className="flex justify-between text-[10px]">
                    <span className="flex items-center gap-1 truncate text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PIPELINE_COLORS[i] }} />
                      {p.name}
                    </span>
                    <span className="tabular-nums text-slate-300">{p.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartPanel>

        <ChartPanel title="Daily trend" subtitle="Failures per day" onExpand={() => setTheaterChart("dailyTrend")}>
          {dailyTrend.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No data</p>
          ) : (
            trendChart(120)
          )}
        </ChartPanel>
      </div>

      {expandedKpi && (
        <div className="rounded-lg border border-sky-500/20 bg-slate-900/60 p-2.5">
          {expandedKpi === "failures" && (
            <>
              <h4 className="mb-2 text-xs font-semibold text-slate-300">Failure breakdown</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">Total</p>
                  <p className="text-base font-bold text-red-300">{total}</p>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">With site</p>
                  <p className="text-base font-bold text-amber-300">{siteLinked}</p>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                  <p className="text-[9px] text-slate-500">No site</p>
                  <p className="text-base font-bold text-slate-300">{overview?.noSiteFailures ?? 0}</p>
                </div>
              </div>
            </>
          )}
          {expandedKpi === "sites" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-300">
                  All sites ({filteredTopSites.length}{siteKpiSearch ? ` / ${topSites.length}` : ""})
                </h4>
                <div className="relative min-w-[200px] max-w-xs">
                  <input
                    type="text"
                    value={siteKpiSearch}
                    onChange={(e) => {
                      setSiteKpiSearch(e.target.value);
                      setSiteKpiPage(1);
                    }}
                    placeholder="Search site code or name..."
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  {siteKpiSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteKpiSearch("");
                        setSiteKpiPage(1);
                      }}
                      className="absolute right-1.5 top-0.5 text-xs text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Top Pagination */}
              <TablePaginationBar
                page={safeKpiPage}
                totalPages={totalKpiPages}
                totalItems={filteredTopSites.length}
                pageSize={siteKpiPageSize}
                onPageChange={setSiteKpiPage}
                onPageSizeChange={setSiteKpiPageSize}
                pageSizeOptions={[5, 10, 25, 50, -1]}
                label="failing sites"
              />

              <div className="overflow-hidden rounded border border-slate-800">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wide">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">Site</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Clinic Name</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Failures</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {pagedTopSites.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                          No sites match "{siteKpiSearch}"
                        </td>
                      </tr>
                    ) : (
                      pagedTopSites.map((s) => (
                        <tr
                          key={s.site}
                          className="cursor-pointer hover:bg-slate-800/60"
                          onClick={() => onSelectSite?.(s.site)}
                          title={`View failures for ${s.site}`}
                        >
                          <td className="px-2.5 py-1 font-semibold text-sky-300">{s.site}</td>
                          <td className="px-2.5 py-1 text-slate-400 truncate max-w-[200px]">{s.siteName || "—"}</td>
                          <td className="px-2.5 py-1 text-right tabular-nums text-red-300 font-medium">{s.failures}</td>
                          <td className="px-2.5 py-1 text-right">
                            <span className="text-sky-400 hover:underline text-[10px]">Open details ›</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination */}
              <TablePaginationBar
                page={safeKpiPage}
                totalPages={totalKpiPages}
                totalItems={filteredTopSites.length}
                pageSize={siteKpiPageSize}
                onPageChange={setSiteKpiPage}
                onPageSizeChange={setSiteKpiPageSize}
                pageSizeOptions={[5, 10, 25, 50, -1]}
                label="failing sites"
              />
            </div>
          )}
          {expandedKpi === "avg" && (
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Average</p>
                <p className="font-bold text-sky-300">{avgPerSite}</p>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Worst site</p>
                <p className="font-bold text-amber-300">{topSites[0] ? `${topSites[0].site} (${topSites[0].failures})` : "—"}</p>
              </div>
              <div className="rounded border border-slate-800 px-2 py-1.5">
                <p className="text-[9px] text-slate-500">Single failure</p>
                <p className="font-bold text-slate-300">{topSites.filter((s) => s.failures === 1).length} sites</p>
              </div>
            </div>
          )}
          {expandedKpi === "pipelines" && (
            <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs">
              {byPipeline.map((p, i) => (
                <li key={p.fullName} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                  <span className="truncate text-slate-300" title={p.fullName}>{p.fullName}</span>
                  <span className="tabular-nums text-red-300">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ChartTheater
        title={theaterChart === "topSites" ? "Top sites" : theaterChart === "byPipeline" ? "By pipeline" : "Daily trend"}
        subtitle="Enlarged view — Esc or click outside to close"
        open={theaterChart !== null}
        onClose={() => setTheaterChart(null)}
      >
        {theaterChart === "topSites" && topSitesChart(Math.min(480, 40 + topSites.length * 28), topSites.length)}
        {theaterChart === "byPipeline" && pipelineChart(360, true)}
        {theaterChart === "dailyTrend" && trendChart(400, true)}
      </ChartTheater>
    </div>
  );
}
