import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "../components/FabricLink";
import { SiteFailuresDashboard } from "../components/SiteFailuresDashboard";
import {
  FailureDetailDrawer,
  SiteFailuresDrawer,
  type SiteSummaryMeta,
} from "../components/SiteFailuresDrawer";
import { TablePagination } from "../components/TablePagination";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import type { FailedTask, GlobalFilters } from "../types";

type ViewMode = "sites" | "all";

const PAGE_SIZE = 50;

function siteFailuresFilters(filters: GlobalFilters): GlobalFilters {
  return {
    ...filters,
    targetName: filters.targetName || "BR",
    configName: filters.configName || undefined,
  };
}

import { formatCstShort } from "../utils/formatDate";

function formatShortTime(value?: string): string {
  return formatCstShort(value);
}

import { TablePaginationBar } from "../components/TablePaginationBar";

function FailedTasksTable({
  failures,
  onOpenTask,
  onSelectSite,
  emptyMessage,
}: {
  failures: FailedTask[];
  onOpenTask: (task: FailedTask) => void;
  onSelectSite?: (site: string) => void;
  emptyMessage: string;
}) {
  if (failures.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Pipeline</th>
            <th className="px-3 py-2 font-medium">Site</th>
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">Error</th>
            <th className="px-3 py-2 font-medium">Run</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {failures.map((row) => {
            const rowKey = `${row.TaskId || row.PipelineRunId}-${row.StartTime}`;
            return (
              <tr
                key={rowKey}
                className="cursor-pointer hover:bg-slate-800/50"
                onClick={() => onOpenTask(row)}
                title="Click for full error details"
              >
                <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{formatShortTime(row.StartTime)}</td>
                <td className="max-w-[200px] truncate px-3 py-1.5 text-slate-200" title={row.ConfigName}>
                  {row.ConfigName}
                </td>
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  {row.SiteCode ? (
                    <button
                      type="button"
                      className="font-medium text-sky-300 hover:underline"
                      onClick={() => onSelectSite?.(row.SiteCode!)}
                    >
                      {row.SiteCode}
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FailuresPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [view, setView] = useState<ViewMode>("sites");
  const [selectedSite, setSelectedSite] = useState<SiteSummaryMeta | null>(null);
  const [selectedTask, setSelectedTask] = useState<FailedTask | null>(null);
  const [page, setPage] = useState(1);

  const pageFilters = useMemo(() => siteFailuresFilters(filters), [filters]);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["failureOverview", pageFilters],
    queryFn: () => api.failureOverview(pageFilters),
  });

  const { data: siteSummary, isLoading: sitesLoading } = useQuery({
    queryKey: ["siteFailureSummary", pageFilters],
    queryFn: () => api.siteFailureSummary({ ...pageFilters, limit: 200 }),
  });

  const { data: dashboardTasks } = useQuery({
    queryKey: ["failedTasks", "dashboard", pageFilters],
    queryFn: () => api.failedTasks({ ...pageFilters, limit: 500, offset: 0 }),
  });

  const [allPageSize, setAllPageSize] = useState<number>(50);

  const allTaskFilters = useMemo(
    () => ({
      ...pageFilters,
      limit: allPageSize === -1 ? 5000 : allPageSize,
      offset: allPageSize === -1 ? 0 : (page - 1) * allPageSize,
    }),
    [pageFilters, page, allPageSize],
  );

  const { data: allFailuresData, isLoading: allLoading } = useQuery({
    queryKey: ["failedTasks", "bronze", allTaskFilters],
    queryFn: () => api.failedTasks(allTaskFilters),
    enabled: view === "all",
  });

  const sites = siteSummary?.sites ?? [];
  const siteCount = overview?.siteCount ?? 0;
  const [search, setSearch] = useState("");
  const [sitePage, setSitePage] = useState(1);
  const [sitePageSize, setSitePageSize] = useState<number>(25);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        (s.SiteCode || "").toLowerCase().includes(q) ||
        (s.DataBaseName || "").toLowerCase().includes(q) ||
        (s.SiteName || "").toLowerCase().includes(q) ||
        (s.sample_pipeline || "").toLowerCase().includes(q)
    );
  }, [sites, search]);

  const isAllSites = sitePageSize === -1;
  const totalSitePages = isAllSites ? 1 : Math.max(1, Math.ceil(filteredSites.length / sitePageSize));
  const safeSitePage = Math.min(Math.max(sitePage, 1), totalSitePages);

  const pagedSites = useMemo(() => {
    if (isAllSites) return filteredSites;
    const start = (safeSitePage - 1) * sitePageSize;
    return filteredSites.slice(start, start + sitePageSize);
  }, [filteredSites, safeSitePage, sitePageSize, isAllSites]);

  const totalAllPages = allPageSize === -1 ? 1 : Math.max(1, Math.ceil((allFailuresData?.total ?? 0) / allPageSize));

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);

  const exportSitesCsv = () => {
    const dataToExport = filteredSites;
    if (dataToExport.length === 0) return;
    const headers = ["SiteCode", "DataBaseName", "SiteName", "FailureCount", "PipelineCount", "LastFailure", "ExamplePipeline"];
    const rows = dataToExport.map((s) => [
      `"${s.SiteCode || ""}"`,
      `"${s.DataBaseName || ""}"`,
      `"${s.SiteName || ""}"`,
      s.failure_count || 0,
      s.pipeline_count || 0,
      `"${s.last_failure || ""}"`,
      `"${(s.sample_pipeline || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `site_failures_${dateLabel ? dateLabel.replace(/[^0-9a-zA-Z_-]/g, "_") : "export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    setPage(1);
    setSitePage(1);
  }, [filters.configName, filters.targetName, filters.startDateFrom, filters.startDateTo, search, view]);

  const openSite = (site: SiteSummaryMeta) => {
    setSelectedTask(null);
    setSelectedSite(site);
  };

  const openSiteByCode = (siteCode: string) => {
    const meta = sites.find((s) => s.SiteCode === siteCode);
    openSite(
      meta ?? {
        SiteCode: siteCode,
      },
    );
  };

  const closeDrawers = () => {
    setSelectedSite(null);
    setSelectedTask(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-100">Site Failures Dashboard</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Bronze site-load failures{dateLabel ? ` · ${dateLabel}` : ""} — click a KPI or chart to expand, or a site row for the side panel.
        </p>
      </div>

      <SiteFailuresDashboard
        overview={overview}
        sites={sites}
        tasks={(dashboardTasks?.failures ?? []) as FailedTask[]}
        isLoading={overviewLoading || sitesLoading}
        onSelectSite={openSiteByCode}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("sites")}
            className={`rounded-md px-3 py-1.5 ${view === "sites" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            By site ({search ? `${filteredSites.length}/` : ""}{siteCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setView("all");
              closeDrawers();
            }}
            className={`rounded-md px-3 py-1.5 ${view === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            All bronze failures ({overview?.totalFailures ?? "…"})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live Search Input */}
          <div className="relative min-w-[240px] max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search site, database, pipeline..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <svg
              className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500"
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
                className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Export CSV button */}
          {view === "sites" && filteredSites.length > 0 && (
            <button
              type="button"
              onClick={exportSitesCsv}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              title="Export failing sites list to CSV"
            >
              <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {view === "sites" ? (
        <section className="space-y-2">
          {sitesLoading ? (
            <p className="text-sm text-slate-400">Loading site summary…</p>
          ) : sites.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
              <p className="font-medium text-slate-300">No Bronze site failures in this date range</p>
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
              <p className="font-medium text-slate-300">No clinic sites match "{search}"</p>
            </div>
          ) : (
            <>
              {/* Top Pagination */}
              <TablePaginationBar
                page={safeSitePage}
                totalPages={totalSitePages}
                totalItems={filteredSites.length}
                pageSize={sitePageSize}
                onPageChange={setSitePage}
                onPageSizeChange={setSitePageSize}
                label="failing sites"
              />

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
                    {pagedSites.map((site) => (
                      <tr
                        key={site.SiteCode}
                        className={`cursor-pointer hover:bg-slate-800/60 ${selectedSite?.SiteCode === site.SiteCode ? "bg-sky-950/30" : ""}`}
                        onClick={() => openSite(site)}
                        title="Open site failure details"
                      >
                        <td className="px-3 py-1.5">
                          <span className="font-semibold text-sky-300">{site.SiteCode}</span>
                          {site.SiteName && <span className="ml-2 text-slate-500">{site.SiteName}</span>}
                        </td>
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

              {/* Bottom Pagination */}
              <TablePaginationBar
                page={safeSitePage}
                totalPages={totalSitePages}
                totalItems={filteredSites.length}
                pageSize={sitePageSize}
                onPageChange={setSitePage}
                onPageSizeChange={setSitePageSize}
                label="failing sites"
              />
            </>
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {allLoading ? (
            <p className="text-sm text-slate-400">Loading bronze failures…</p>
          ) : (
            <>
              {/* Top Pagination for All Failures */}
              <TablePaginationBar
                page={page}
                totalPages={totalAllPages}
                totalItems={allFailuresData?.total ?? 0}
                pageSize={allPageSize}
                onPageChange={setPage}
                onPageSizeChange={setAllPageSize}
                label="bronze failures"
              />

              <FailedTasksTable
                failures={(allFailuresData?.failures ?? []) as FailedTask[]}
                onOpenTask={(task) => {
                  setSelectedSite(null);
                  setSelectedTask(task);
                }}
                onSelectSite={openSiteByCode}
                emptyMessage={`No Bronze failures in ${dateLabel || "the selected date range"}.`}
              />

              {/* Bottom Pagination for All Failures */}
              <TablePaginationBar
                page={page}
                totalPages={totalAllPages}
                totalItems={allFailuresData?.total ?? 0}
                pageSize={allPageSize}
                onPageChange={setPage}
                onPageSizeChange={setAllPageSize}
                label="bronze failures"
              />
            </>
          )}
        </section>
      )}

      <SiteFailuresDrawer
        site={selectedSite}
        queryFilters={pageFilters}
        dateLabel={dateLabel || "Selected period"}
        onClose={() => setSelectedSite(null)}
      />

      <FailureDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
