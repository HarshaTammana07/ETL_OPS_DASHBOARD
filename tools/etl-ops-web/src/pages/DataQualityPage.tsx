import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import type { GlobalFilters } from "../types";

export function DataQualityPage() {
  const { filters } = useOutletContext<{ filters: GlobalFilters }>();

  const { data, isLoading } = useQuery({
    queryKey: ["dqIssues", filters],
    queryFn: () => api.dqIssues(filters),
  });

  if (isLoading) return <p className="text-slate-400">Loading data quality issues…</p>;

  return (
    <DataTable
      rows={data?.issues ?? []}
      emptyMessage="No data quality issues in lookback window"
      columns={[
        { key: "CreatedAt", label: "Created" },
        { key: "TableName", label: "Table" },
        { key: "ValidationStatus", label: "Status", render: (v) => <StatusBadge status={v} /> },
        { key: "RowCount", label: "Rows" },
        { key: "NullCount", label: "Nulls" },
        { key: "DuplicateCount", label: "Duplicates" },
        { key: "ConfigName", label: "Pipeline" },
        { key: "TargetName", label: "Layer" },
      ]}
    />
  );
}
