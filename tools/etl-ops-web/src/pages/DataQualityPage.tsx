import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { DataQualityDashboard } from "../components/DataQualityDashboard";
import { DataQualityDrawer, type DqIssueRow } from "../components/DataQualityDrawer";
import { fabricLinkColumn } from "../components/FabricLink";
import { LayerBadge, StatusBadge } from "../components/StatusBadge";
import { TablePagination } from "../components/TablePagination";
import { formatDateRange } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";
import { formatCountDisplay } from "../utils/formatNumber";

const PAGE_SIZE = 50;

function CountCell({
  value,
  tone = "default",
}: {
  value: string;
  tone?: "default" | "amber" | "red";
}) {
  const n = Number(value);
  const { text, title } = formatCountDisplay(value);
  const toneClass =
    tone === "amber" && n > 0
      ? "text-amber-300"
      : tone === "red" && n > 0
        ? "text-red-300"
        : "text-slate-400";
  return (
    <span className={`tabular-nums ${tone === "default" ? "text-slate-200" : toneClass}`} title={title}>
      {text}
    </span>
  );
}

import { formatCstShort } from "../utils/formatDate";

function formatShortTime(value?: string): string {
  return formatCstShort(value);
}

export function DataQualityPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [page, setPage] = useState(1);
  const [selectedIssue, setSelectedIssue] = useState<DqIssueRow | null>(null);

  const dateLabel = formatDateRange(filters.startDateFrom, filters.startDateTo);
  const offset = (page - 1) * PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [filters.configName, filters.targetName, filters.startDateFrom, filters.startDateTo]);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["dqOverview", filters],
    queryFn: () => api.dqOverview(filters),
  });

  const { data: chartIssues } = useQuery({
    queryKey: ["dqIssues", "dashboard", filters],
    queryFn: () => api.dqIssues({ ...filters, limit: 500, offset: 0 }),
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["dqIssues", filters, PAGE_SIZE, offset],
    queryFn: () => api.dqIssues({ ...filters, limit: PAGE_SIZE, offset }),
  });

  const total = issuesData?.total ?? 0;
  const issues = (issuesData?.issues ?? []) as DqIssueRow[];

  const openIssue = (row: Record<string, string>) => {
    setSelectedIssue(row as unknown as DqIssueRow);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-100">Data Quality Dashboard</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Non-pass validation rows from <span className="text-slate-300">dataquality</span>
          {dateLabel ? ` · ${dateLabel}` : ""} — click a KPI, chart, or table row for details.
        </p>
      </div>

      <DataQualityDashboard
        overview={overview}
        issues={(chartIssues?.issues ?? []) as DqIssueRow[]}
        isLoading={overviewLoading}
        onSelectIssue={setSelectedIssue}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Validation issues</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {issuesLoading ? "Loading…" : `${total} issue${total === 1 ? "" : "s"} in window`}
            </p>
          </div>
          <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} compact className="justify-end" />
        </div>

        <DataTable
          rows={issues as unknown as Record<string, string>[]}
          emptyMessage={
            dateLabel
              ? `No data quality issues in ${dateLabel} — try widening the date range`
              : "No data quality issues in the selected window"
          }
          onRowClick={openIssue}
          columns={[
            { key: "CreatedAt", label: "Created", render: (v) => formatShortTime(v) },
            { key: "TableName", label: "Table" },
            { key: "ValidationStatus", label: "Status", render: (v) => <StatusBadge status={v} /> },
            {
              key: "RowCount",
              label: "Rows",
              render: (v) => <CountCell value={v ?? "0"} />,
            },
            {
              key: "NullCount",
              label: "Nulls",
              render: (v) => <CountCell value={v ?? "0"} tone="amber" />,
            },
            {
              key: "DuplicateCount",
              label: "Dupes",
              render: (v) => <CountCell value={v ?? "0"} tone="red" />,
            },
            {
              key: "ConfigName",
              label: "Pipeline",
              render: (v) => (
                <span className="max-w-[200px] truncate text-sky-300" title={v}>
                  {v || "—"}
                </span>
              ),
            },
            { key: "TargetName", label: "Layer", render: (v) => (v ? <LayerBadge layer={v} /> : "—") },
            fabricLinkColumn(),
          ]}
        />

        <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="justify-between" />
      </section>

      <DataQualityDrawer issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
    </div>
  );
}
