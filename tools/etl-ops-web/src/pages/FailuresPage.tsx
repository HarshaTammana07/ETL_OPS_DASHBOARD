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
import type { FilterContext } from "../hooks/useFilterContext";
import type { FailedTask, GlobalFilters } from "../types";

type ViewMode = "sites" | "all";

const PAGE_SIZE = 50;

/** Fixed reporting window for Site Failures (page-only; global date bar ignored). */
export const SITE_FAILURES_FROM = "2026-08-30";
export const SITE_FAILURES_TO = "2026-09-08";
export const SITE_FAILURES_FROM_DISPLAY = "30-08-2026";
export const SITE_FAILURES_TO_DISPLAY = "08-09-2026";
const SITE_FAILURES_RANGE_LABEL = `${SITE_FAILURES_FROM_DISPLAY} – ${SITE_FAILURES_TO_DISPLAY}`;

function sammsPipelineFilter(configName?: string): string {
  const term = configName?.trim();
  if (!term) return "SAMMS%";
  if (/^samms/i.test(term)) return term.includes("%") ? term : `${term}%`;
  return "SAMMS%";
}

function siteFailuresFilters(filters: GlobalFilters): GlobalFilters {
  const {
    targetName: _layer,
    startDateFrom: _from,
    startDateTo: _to,
    refDate: _ref,
    lookbackDays: _lookback,
    ...rest
  } = filters;
  return {
    ...rest,
    startDateFrom: SITE_FAILURES_FROM,
    startDateTo: SITE_FAILURES_TO,
    targetName: "BR",
    configName: sammsPipelineFilter(rest.configName),
  };
}

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

  const allTaskFilters = useMemo(
    () => ({
      ...pageFilters,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [pageFilters, page],
  );

  const { data: allFailuresData, isLoading: allLoading } = useQuery({
    queryKey: ["failedTasks", "bronze", allTaskFilters],
    queryFn: () => api.failedTasks(allTaskFilters),
    enabled: view === "all",
  });

  const sites = siteSummary?.sites ?? [];
  const siteCount = overview?.siteCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filters.configName, view]);

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
          Bronze SAMMS site-load failures — click a KPI or chart to expand, or a site row for the side panel.
        </p>
      </div>

      <SiteFailuresDashboard
        overview={overview}
        sites={sites}
        tasks={(dashboardTasks?.failures ?? []) as FailedTask[]}
        isLoading={overviewLoading || sitesLoading}
        onSelectSite={openSiteByCode}
      />

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
          onClick={() => {
            setView("all");
            closeDrawers();
          }}
          className={`rounded-md px-3 py-1.5 ${view === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          All bronze failures ({overview?.totalFailures ?? "…"})
        </button>
      </div>

      {view === "sites" ? (
        <section>
          {sitesLoading ? (
            <p className="text-sm text-slate-400">Loading site summary…</p>
          ) : sites.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
              <p className="font-medium text-slate-300">No Bronze site failures in this date range</p>
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
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {allLoading ? (
            <p className="text-sm text-slate-400">Loading bronze failures…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Click a row for full error details in the side panel.</p>
                <TablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={allFailuresData?.total ?? 0}
                  onPageChange={setPage}
                  compact
                />
              </div>
              <FailedTasksTable
                failures={(allFailuresData?.failures ?? []) as FailedTask[]}
                onOpenTask={(task) => {
                  setSelectedSite(null);
                  setSelectedTask(task);
                }}
                onSelectSite={openSiteByCode}
                emptyMessage={`No Bronze failures in ${SITE_FAILURES_RANGE_LABEL}.`}
              />
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={allFailuresData?.total ?? 0}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      )}

      <SiteFailuresDrawer
        site={selectedSite}
        queryFilters={pageFilters}
        dateLabel={SITE_FAILURES_RANGE_LABEL}
        onClose={() => setSelectedSite(null)}
      />

      <FailureDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
