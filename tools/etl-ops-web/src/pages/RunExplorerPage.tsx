import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { fabricLinkColumn } from "../components/FabricLink";
import { LayerBadge, StatusBadge } from "../components/StatusBadge";
import { buildTrendsHref } from "../components/TrendsScopeBar";
import type { GlobalFilters } from "../types";

export function RunExplorerPage() {
  const { filters } = useOutletContext<{ filters: GlobalFilters }>();
  const [searchParams] = useSearchParams();
  const [runId, setRunId] = useState(searchParams.get("runId") ?? "");
  const [pipelineRunId, setPipelineRunId] = useState(searchParams.get("pipelineRunId") ?? "");
  const [siteCode, setSiteCode] = useState(searchParams.get("siteCode") ?? filters.siteCode ?? "");
  const [submitted, setSubmitted] = useState({
    runId: searchParams.get("runId") ?? "",
    pipelineRunId: searchParams.get("pipelineRunId") ?? "",
    siteCode: searchParams.get("siteCode") ?? filters.siteCode ?? "",
  });

  const { data, isFetching } = useQuery({
    queryKey: ["searchRuns", submitted, filters.refDate],
    queryFn: () =>
      api.searchRuns({
        runId: submitted.runId || undefined,
        pipelineRunId: submitted.pipelineRunId || undefined,
        siteCode: submitted.siteCode || undefined,
        refDate: filters.refDate,
      }),
    enabled: !!(submitted.runId || submitted.pipelineRunId || submitted.siteCode),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted({ runId, pipelineRunId, siteCode });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Run ID
          <input value={runId} onChange={(e) => setRunId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
        </label>
        <label className="flex min-w-[280px] flex-col gap-1 text-xs text-slate-400">
          Pipeline Run ID
          <input value={pipelineRunId} onChange={(e) => setPipelineRunId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Site code
          <input value={siteCode} onChange={(e) => setSiteCode(e.target.value)} className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm uppercase" />
        </label>
        <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500">
          Search
        </button>
      </form>

      {isFetching && <p className="text-slate-400">Searching…</p>}

      <DataTable
        rows={data?.results ?? []}
        emptyMessage="Enter a Run ID, Pipeline Run ID, or site code to search"
        columns={[
          { key: "RunId", label: "Run ID" },
          { key: "PipelineRunId", label: "Parent run" },
          { key: "ConfigName", label: "Pipeline" },
          { key: "TargetName", label: "Layer", render: (v) => <LayerBadge layer={v} /> },
          { key: "Status", label: "Status", render: (v) => <StatusBadge status={v} /> },
          { key: "SiteCode", label: "Site" },
          { key: "StartTime", label: "Start" },
          { key: "RowsWritten", label: "Rows written" },
          {
            key: "_trends",
            label: "Trends",
            render: (_: string, row: Record<string, string>) => (
              <span className="flex flex-col gap-0.5 whitespace-nowrap">
                {row.PipelineRunId && (
                  <Link
                    to={buildTrendsHref({ pipelineRunId: row.PipelineRunId })}
                    className="text-sky-400 hover:underline"
                    title="KPIs for parent run (all layers)"
                  >
                    All layers
                  </Link>
                )}
                {row.RunId && (
                  <Link
                    to={buildTrendsHref({ runId: row.RunId })}
                    className="text-slate-400 hover:text-sky-300 hover:underline"
                    title="KPIs for this layer run only"
                  >
                    This layer
                  </Link>
                )}
              </span>
            ),
          },
          fabricLinkColumn(),
        ]}
      />
    </div>
  );
}
