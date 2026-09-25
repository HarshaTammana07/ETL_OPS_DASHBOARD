import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, apiConnectionHint } from "../api/client";
import { CombinedRunDetailsDrawer } from "../components/CombinedRunDetailsDrawer";
import { GroupedRunsView } from "../components/GroupedRunsView";
import { RunDetailsDrawer } from "../components/RunDetailsDrawer";
import { TablePagination } from "../components/TablePagination";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { RunMeta } from "../components/FabricLink";
import type { PipelineRun } from "../types";
import {
  isBronzeFailedFilter,
  kpiQueryFilters,
  tableFilterLabel,
  type FilterContext,
} from "../hooks/useFilterContext";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function HomePage() {
  const { filters, setFilters } = useOutletContext<FilterContext>();
  const kpiFilters = kpiQueryFilters(filters);
  const tableFilter = tableFilterLabel(filters);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRun, setSelectedRun] = useState<RunMeta | null>(null);
  const [selectedGroupRunId, setSelectedGroupRunId] = useState<string | null>(null);
  const [selectedGroupRuns, setSelectedGroupRuns] = useState<PipelineRun[] | null>(null);

  // Live search as you type (debounced)
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Reset to first page when KPI/global filters or search change
  useEffect(() => {
    setPage(1);
  }, [
    filters.status,
    filters.targetName,
    filters.configName,
    filters.siteCode,
    filters.startDateFrom,
    filters.startDateTo,
    filters.refDate,
    searchQuery,
  ]);

  const { data: kpis, isLoading, isError, error } = useQuery({
    queryKey: ["dailyKpis", kpiFilters],
    queryFn: () => api.dailyKpis(kpiFilters),
  });

  const offset = (page - 1) * PAGE_SIZE;
  const { data: runsData, isFetching: runsFetching } = useQuery({
    queryKey: ["recentRuns", filters, PAGE_SIZE, offset, searchQuery],
    queryFn: () =>
      api.recentRuns({
        ...filters,
        limit: PAGE_SIZE,
        offset,
        q: searchQuery || undefined,
      }),
  });

  const showAllRuns = () => {
    if (isBronzeFailedFilter(filters)) {
      setFilters({ status: undefined, targetName: undefined });
    } else {
      setFilters({ status: undefined });
    }
  };

  const toggleStatus = (status: string) => {
    if (filters.status === status && !isBronzeFailedFilter(filters)) {
      setFilters({ status: undefined });
      return;
    }
    setFilters({
      status,
      ...(isBronzeFailedFilter(filters) ? { targetName: undefined } : {}),
    });
  };

  const toggleBronzeFailed = () => {
    if (isBronzeFailedFilter(filters)) {
      setFilters({ status: undefined, targetName: undefined });
    } else {
      setFilters({ status: "FAILED", targetName: "BR" });
    }
  };

  if (isLoading) return <p className="text-slate-400">Loading KPIs…</p>;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-4 text-sm text-red-200">
        <p className="font-medium">Could not load dashboard data</p>
        <p className="mt-1 text-red-300/90">{(error as Error).message}</p>
        <p className="mt-2 text-xs text-red-300/70">{apiConnectionHint()}</p>
      </div>
    );
  }

  const dateLabel = formatDateRange(kpis?.startDateFrom, kpis?.startDateTo);
  const allActive = !filters.status && !isBronzeFailedFilter(filters);
  const total = runsData?.total ?? 0;

  return (
    <div className="space-y-4">
      {kpis && kpis.failedRuns > 0 && !tableFilter && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-sm text-red-200">
          <span className="font-semibold">{kpis.failedRuns}</span> failed run(s) in {dateLabel}
        </div>
      )}

      {/* KPI Summary Bar - Compact & Horizontal */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
        <div
          onClick={showAllRuns}
          className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
            allActive
              ? "border-sky-500/50 bg-sky-500/10"
              : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70"
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Runs</div>
          <div className="text-xl font-bold text-slate-100">{kpis?.totalRuns ?? 0}</div>
          <div className="text-[10px] text-slate-500">{dateLabel}</div>
        </div>

        <div
          onClick={() => toggleStatus("SUCCESS")}
          className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
            filters.status === "SUCCESS"
              ? "border-emerald-500/50 bg-emerald-500/10"
              : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70"
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Success</div>
          <div className="text-xl font-bold text-emerald-400">{kpis?.successPct ?? 0}%</div>
          <div className="text-[10px] text-slate-500">{kpis?.totalRuns ?? 0} runs</div>
        </div>

        <div
          onClick={() => toggleStatus("FAILED")}
          className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
            filters.status === "FAILED" && filters.targetName !== "BR"
              ? "border-red-500/50 bg-red-500/10"
              : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70"
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Failed</div>
          <div className="text-xl font-bold text-red-400">{kpis?.failedRuns ?? 0}</div>
          <div className="text-[10px] text-slate-500">{kpis?.failedPct ?? 0}% of runs</div>
        </div>

        <div
          onClick={() => toggleStatus("RUNNING")}
          className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
            filters.status === "RUNNING"
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70"
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Running</div>
          <div className="text-xl font-bold text-amber-400">{kpis?.runningRuns ?? 0}</div>
          <div className="text-[10px] text-slate-500">{kpis?.runningPct ?? 0}% pipelines</div>
        </div>

        <div
          onClick={toggleBronzeFailed}
          className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
            isBronzeFailedFilter(filters)
              ? "border-red-500/50 bg-red-500/10"
              : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/70"
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Failed Sites</div>
          <div className="text-xl font-bold text-red-400">{kpis?.failedSiteCount ?? 0}</div>
          <div className="text-[10px] text-slate-500">Bronze layer</div>
        </div>
      </div>

      {/* Recent Runs Table Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Recent Runs
            {tableFilter && <span className="ml-2 font-normal text-slate-400">({tableFilter})</span>}
          </h2>
          {runsFetching && <span className="text-xs text-slate-500">Updating…</span>}
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <label className="sr-only" htmlFor="recent-runs-search">
              Search recent runs
            </label>
            <input
              id="recent-runs-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search pipeline or run ID…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-3 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-slate-500 hover:text-slate-200"
                title="Clear search"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            compact
            className="justify-end"
          />
        </div>

        <GroupedRunsView
          runs={(runsData?.runs ?? []) as any}
          onExpandRun={(run) => {
            setSelectedRun({
              RunId: run.RunId,
              PipelineRunId: run.PipelineRunId,
              ConfigId: run.ConfigId || "",
              ConfigName: run.ConfigName,
              TargetName: run.TargetName,
            });
          }}
          onExpandGroupDetails={(pipelineRunId, runs) => {
            setSelectedGroupRunId(pipelineRunId);
            setSelectedGroupRuns(runs);
          }}
          emptyMessage={
            searchQuery
              ? `No runs matching "${searchQuery}"${tableFilter ? ` (${tableFilter})` : ""} in ${dateLabel}`
              : tableFilter
                ? `No ${tableFilter.toLowerCase()} runs with StartTime in ${dateLabel}`
                : `No runs with StartTime in ${dateLabel} — try another range`
          }
        />
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          className="mt-3 justify-between"
        />
      </section>

      {/* Run Details Drawer - Individual Layer */}
      <RunDetailsDrawer meta={selectedRun} onClose={() => setSelectedRun(null)} />

      {/* Combined Details Drawer - All Layers */}
      <CombinedRunDetailsDrawer
        pipelineRunId={selectedGroupRunId}
        runs={selectedGroupRuns}
        onClose={() => {
          setSelectedGroupRunId(null);
          setSelectedGroupRuns(null);
        }}
      />
    </div>
  );
}
