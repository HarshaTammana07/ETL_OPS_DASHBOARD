import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { FabricLink, fabricLinkColumn, rowToRunMeta } from "../components/FabricLink";
import { LayerBadge, StatusBadge } from "../components/StatusBadge";
import { buildTrendsHref } from "../components/TrendsScopeBar";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";

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
  const { filters, setFilters } = useOutletContext<FilterContext>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [hideIdle, setHideIdle] = useState(false);
  const [search, setSearch] = useState("");

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["pipelinesOverview", filters],
    queryFn: () => api.pipelinesOverview(filters),
  });

  const { data: runs } = useQuery({
    queryKey: ["pipelineRuns", filters],
    queryFn: () => api.pipelineRuns({ ...filters, limit: 50 }),
  });

  const { data: layers } = useQuery({
    queryKey: ["pipelineLayers", selectedRunId],
    queryFn: () => api.pipelineLayers(selectedRunId!),
    enabled: !!selectedRunId,
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

  const withRuns = (overview?.pipelines ?? []).filter((r) => Number(r.runs_in_window || 0) > 0).length;
  const totalConfigs = overview?.pipelines?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
        <p className="font-medium text-slate-100">ETL module catalog</p>
        <p className="mt-1 text-xs text-slate-400">
          Registered pipelines from <span className="text-slate-300">etlconfig</span> — including modules with no runs in the
          selected window ({dateLabel || "set dates above"}). Use Home for live ops; Trends for analysis.
        </p>
      </div>

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
          </div>
        </div>
        <DataTable
          rows={catalogRows as unknown as Record<string, string>[]}
          emptyMessage={
            hideIdle
              ? "No modules with runs in this window — try another date or uncheck Hide idle"
              : "No registered pipeline configs match your filters"
          }
          columns={[
            {
              key: "ConfigName",
              label: "Config",
              render: (v) => (
                <button
                  type="button"
                  className="max-w-[240px] truncate text-left text-sky-300 hover:underline"
                  title={v}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters({ configName: v });
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
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent executions</h2>
        <p className="mb-3 text-xs text-slate-500">Latest 50 layer runs in the date window — click a row for BR/SL/GL breakdown.</p>
        <DataTable
          rows={(runs?.runs ?? []) as unknown as Record<string, string>[]}
          emptyMessage="No runs in the selected window"
          onRowClick={(row) => setSelectedRunId(row.PipelineRunId)}
          columns={[
            { key: "ConfigName", label: "Pipeline" },
            { key: "TargetName", label: "Layer", render: (v) => <LayerBadge layer={v} /> },
            { key: "Status", label: "Status", render: (v) => <StatusBadge status={v} /> },
            { key: "StartTime", label: "Start", render: (v) => formatShortTime(v) },
            {
              key: "PipelineRunId",
              label: "Parent run",
              render: (v) => (
                <span className="font-mono text-[11px] text-slate-400" title={v}>
                  {v ? `${v.slice(0, 8)}…` : "—"}
                </span>
              ),
            },
            fabricLinkColumn(),
          ]}
        />
      </section>

      {selectedRunId && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Layer breakdown</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={buildTrendsHref({ pipelineRunId: selectedRunId })}
                className="text-xs text-sky-400 hover:underline"
              >
                View trends
              </Link>
              <FabricLink
                url={layers?.layers?.[0]?.fabricUrl}
                meta={layers?.layers?.[0] ? rowToRunMeta(layers.layers[0]) : undefined}
                label="Open in Fabric"
                className="text-sm"
              />
              <button type="button" onClick={() => setSelectedRunId(null)} className="text-xs text-slate-400 hover:text-white">
                Close
              </button>
            </div>
          </div>
          <p className="mb-3 font-mono text-[11px] text-slate-500">{selectedRunId}</p>
          <DataTable
            rows={layers?.layers ?? []}
            emptyMessage="No layers for this parent run"
            columns={[
              { key: "ConfigName", label: "Pipeline" },
              { key: "TargetName", label: "Layer", render: (v) => <LayerBadge layer={v} /> },
              { key: "Status", label: "Status", render: (v) => <StatusBadge status={v} /> },
              { key: "StartTime", label: "Start", render: (v) => formatShortTime(v) },
              { key: "EndTime", label: "End", render: (v) => formatShortTime(v) },
              { key: "SuccessTasks", label: "Success" },
              { key: "FailedTasks", label: "Failed" },
              { key: "duration_seconds", label: "Duration (s)" },
              fabricLinkColumn(),
            ]}
          />
        </section>
      )}
    </div>
  );
}
