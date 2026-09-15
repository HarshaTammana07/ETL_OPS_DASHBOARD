import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { PipelinesDashboard } from "../components/PipelinesDashboard";
import {
  PipelineConfigDrawer,
  PipelineRunLayersDrawer,
  type PipelineCatalogRow,
} from "../components/PipelineDrawers";
import { LayerBadge } from "../components/StatusBadge";
import { TablePagination } from "../components/TablePagination";
import { buildTrendsHref } from "../components/TrendsScopeBar";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";

const PAGE_SIZE = 50;

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

function ActiveBadge({ value }: { value: string }) {
  const on = value === "1" || value.toLowerCase() === "true";
  return (
    <span
      className={
        on
          ? "rounded-full bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-300"
          : "rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-500"
      }
    >
      {on ? "Active" : "Inactive"}
    </span>
  );
}

export function PipelinesPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [selectedConfig, setSelectedConfig] = useState<PipelineCatalogRow | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [hideIdle, setHideIdle] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["pipelinesOverview", filters],
    queryFn: () => api.pipelinesOverview(filters),
  });

  const { data: chartRuns } = useQuery({
    queryKey: ["pipelineRuns", "dashboard", filters],
    queryFn: () => api.pipelineRuns({ ...filters, limit: 500 }),
  });

  const catalogRows = useMemo(() => {
    let rows = overview?.pipelines ?? [];
    if (hideIdle) {
      rows = rows.filter((r) => Number(r.runs_in_window || 0) > 0);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.ConfigName || "").toLowerCase().includes(q) ||
          (r.SourceSystem || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [overview?.pipelines, hideIdle, search]);

  useEffect(() => {
    setPage(1);
  }, [filters.configName, filters.targetName, filters.sourceSystem, filters.startDateFrom, filters.startDateTo, hideIdle, search]);

  const catalogTotal = catalogRows.length;
  const catalogPageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return catalogRows.slice(start, start + PAGE_SIZE);
  }, [catalogRows, page]);

  const withRuns = (overview?.pipelines ?? []).filter((r) => Number(r.runs_in_window || 0) > 0).length;
  const totalConfigs = overview?.pipelines?.length ?? 0;

  const openConfig = (row: Record<string, string>) => {
    setSelectedRunId(null);
    setSelectedConfig({
      ConfigName: row.ConfigName,
      TargetName: row.TargetName,
      SourceSystem: row.SourceSystem,
      IsActive: row.IsActive,
      runs_in_window: row.runs_in_window,
      failed_runs: row.failed_runs,
      last_run: row.last_run,
    });
  };

  const openRunLayers = (pipelineRunId: string) => {
    setSelectedRunId(pipelineRunId);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-100">Pipelines Dashboard</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          ETL module catalog from <span className="text-slate-300">etlconfig</span>
          {dateLabel ? ` · ${dateLabel}` : ""} — click a KPI or chart to expand, or a catalog row for pipeline details. Use{" "}
          <Link to="/runs" className="text-sky-400 hover:underline">
            Run Explorer
          </Link>{" "}
          to browse executions.
        </p>
      </div>

      <PipelinesDashboard
        catalog={overview?.pipelines ?? []}
        runs={chartRuns?.runs ?? []}
        isLoading={isLoading}
        onSelectConfig={(row) => {
          setSelectedRunId(null);
          setSelectedConfig(row);
        }}
      />

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Module catalog</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isLoading ? "Loading…" : `${totalConfigs} configs · ${withRuns} ran in window`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search config or source…"
              className="w-52 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={hideIdle}
                onChange={(e) => setHideIdle(e.target.checked)}
                className="rounded border-slate-600"
              />
              Hide idle (0 runs)
            </label>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={catalogTotal}
              onPageChange={setPage}
              compact
              className="justify-end"
            />
          </div>
        </div>
        <DataTable
          rows={catalogPageRows as unknown as Record<string, string>[]}
          emptyMessage={
            hideIdle
              ? "No modules with runs in this window — try another date or uncheck Hide idle"
              : "No registered pipeline configs match your filters"
          }
          onRowClick={openConfig}
          columns={[
            {
              key: "ConfigName",
              label: "Config",
              render: (v, row) => (
                <button
                  type="button"
                  className="max-w-[240px] truncate text-left text-sky-300 hover:underline"
                  title={v}
                  onClick={(e) => {
                    e.stopPropagation();
                    openConfig(row);
                  }}
                >
                  {v || "—"}
                </button>
              ),
            },
            { key: "TargetName", label: "Layer", render: (v) => (v ? <LayerBadge layer={v} /> : "—") },
            { key: "SourceSystem", label: "Source", render: (v) => v || "—" },
            { key: "IsActive", label: "Active", render: (v) => <ActiveBadge value={v} /> },
            { key: "runs_in_window", label: "Runs" },
            {
              key: "failed_runs",
              label: "Failed",
              render: (v) => (
                <span className={Number(v) > 0 ? "font-medium text-red-300" : "text-slate-400"}>{v ?? "0"}</span>
              ),
            },
            { key: "last_run", label: "Last run", render: (v) => formatShortTime(v) },
            {
              key: "_trends",
              label: "",
              render: (_v, row) => (
                <Link
                  to={buildTrendsHref({ configName: row.ConfigName, targetName: row.TargetName as "BR" | "SL" | "GL" | undefined })}
                  className="text-[11px] text-sky-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Trends
                </Link>
              ),
            },
          ]}
        />
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={catalogTotal}
          onPageChange={setPage}
          className="mt-3 justify-between"
        />
      </section>

      <PipelineConfigDrawer
        config={selectedConfig}
        filters={filters}
        onClose={() => setSelectedConfig(null)}
        onSelectRun={(pipelineRunId) => {
          setSelectedConfig(null);
          setSelectedRunId(pipelineRunId);
        }}
      />

      <PipelineRunLayersDrawer pipelineRunId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </div>
  );
}
