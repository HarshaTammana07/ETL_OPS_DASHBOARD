import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { CombinedRunDetailsDrawer } from "../components/CombinedRunDetailsDrawer";
import { GroupedRunsView } from "../components/GroupedRunsView";
import { RunDetailsDrawer } from "../components/RunDetailsDrawer";
import { TablePagination } from "../components/TablePagination";
import type { RunMeta } from "../components/FabricLink";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import type { GlobalFilters, PipelineRun } from "../types";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type SearchMode = "smart" | "pipelineRunId" | "runId" | "site";

function initialMode(params: URLSearchParams): SearchMode {
  if (params.get("pipelineRunId")) return "pipelineRunId";
  if (params.get("runId")) return "runId";
  if (params.get("siteCode")) return "site";
  return "smart";
}

function initialQuery(params: URLSearchParams, mode: SearchMode): string {
  if (mode === "pipelineRunId") return params.get("pipelineRunId") ?? "";
  if (mode === "runId") return params.get("runId") ?? "";
  if (mode === "site") return params.get("siteCode") ?? "";
  return params.get("q") ?? "";
}

function modePlaceholder(mode: SearchMode): string {
  switch (mode) {
    case "pipelineRunId":
      return "Parent pipeline run ID (partial OK)…";
    case "runId":
      return "Layer run ID (partial OK)…";
    case "site":
      return "Site code, e.g. AHK…";
    default:
      return "Search pipeline name, run ID, or pipeline run ID…";
  }
}

function buildQueryFilters(
  globalFilters: GlobalFilters,
  mode: SearchMode,
  query: string,
): Partial<GlobalFilters> & { q?: string } {
  const base: Partial<GlobalFilters> = {
    startDateFrom: globalFilters.startDateFrom,
    startDateTo: globalFilters.startDateTo,
    configName: globalFilters.configName,
    targetName: globalFilters.targetName,
    sourceSystem: globalFilters.sourceSystem,
    status: globalFilters.status,
  };

  const term = query.trim();
  if (!term) return base;

  switch (mode) {
    case "pipelineRunId":
      return { ...base, pipelineRunId: term };
    case "runId":
      return { ...base, runId: term };
    case "site":
      return { ...base, siteCode: term.toUpperCase() };
    default:
      return { ...base, q: term };
  }
}

function searchSummary(mode: SearchMode, query: string, dateLabel: string): string {
  const term = query.trim();
  if (!term) return `All runs in ${dateLabel}`;
  switch (mode) {
    case "pipelineRunId":
      return `Pipeline run ID "${term}"`;
    case "runId":
      return `Run ID "${term}"`;
    case "site":
      return `Site "${term.toUpperCase()}" in ${dateLabel}`;
    default:
      return `"${term}" in ${dateLabel}`;
  }
}

export function RunExplorerPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<SearchMode>(() => initialMode(searchParams));
  const [searchInput, setSearchInput] = useState(() => initialQuery(searchParams, initialMode(searchParams)));
  const [searchQuery, setSearchQuery] = useState(searchInput);
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<RunMeta | null>(null);
  const [selectedGroupRunId, setSelectedGroupRunId] = useState<string | null>(null);
  const [selectedGroupRuns, setSelectedGroupRuns] = useState<PipelineRun[] | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.startDateFrom,
    filters.startDateTo,
    filters.configName,
    filters.targetName,
    filters.status,
    filters.sourceSystem,
    mode,
    searchQuery,
  ]);

  const queryFilters = useMemo(
    () => buildQueryFilters(filters, mode, searchQuery),
    [filters, mode, searchQuery],
  );

  const offset = (page - 1) * PAGE_SIZE;
  const { data, isFetching } = useQuery({
    queryKey: ["explorerRuns", queryFilters, PAGE_SIZE, offset],
    queryFn: () =>
      api.recentRuns({
        ...queryFilters,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);
  const total = data?.total ?? 0;
  const summary = searchSummary(mode, searchQuery, dateLabel);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">Run Explorer</h2>
        <p className="mt-1 text-xs text-slate-400">
          Browse or search pipeline runs by ID, site, or name. Expand a group to see Bronze / Silver / Gold layers,
          open task details, or jump to Trends for deeper analysis.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Search by
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as SearchMode)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100"
          >
            <option value="smart">Smart (name / any ID)</option>
            <option value="pipelineRunId">Pipeline Run ID</option>
            <option value="runId">Layer Run ID</option>
            <option value="site">Site code</option>
          </select>
        </label>

        <div className="relative min-w-[240px] flex-1 max-w-xl">
          <label className="sr-only" htmlFor="explorer-search">
            Search runs
          </label>
          <input
            id="explorer-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={modePlaceholder(mode)}
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Showing <span className="font-medium text-slate-300">{summary}</span>
          {total > 0 && (
            <>
              {" "}
              · <span className="text-slate-500">{total} layer run{total === 1 ? "" : "s"}</span>
            </>
          )}
        </p>
        {isFetching && <span className="text-xs text-slate-500">Updating…</span>}
      </div>

      <GroupedRunsView
        runs={(data?.runs ?? []) as PipelineRun[]}
        showTrendsLinks
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
          searchQuery.trim()
            ? `No runs matching ${summary}`
            : `No runs with StartTime in ${dateLabel} — try another date range or search term`
        }
      />

      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="justify-between" />

      <RunDetailsDrawer meta={selectedRun} onClose={() => setSelectedRun(null)} />

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
