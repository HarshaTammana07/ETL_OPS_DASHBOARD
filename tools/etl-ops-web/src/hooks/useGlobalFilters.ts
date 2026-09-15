import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { GlobalFilters, TargetName } from "../types";

export function useGlobalFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: GlobalFilters = useMemo(
    () => ({
      startDateFrom: searchParams.get("startDateFrom") ?? undefined,
      startDateTo: searchParams.get("startDateTo") ?? undefined,
      refDate: searchParams.get("refDate") ?? undefined,
      lookbackDays: searchParams.get("lookbackDays") ? Number(searchParams.get("lookbackDays")) : undefined,
      configName: searchParams.get("configName") ?? undefined,
      targetName: (searchParams.get("targetName") as TargetName | null) ?? undefined,
      siteCode: searchParams.get("siteCode") ?? undefined,
      sourceSystem: searchParams.get("sourceSystem") ?? undefined,
      method: searchParams.get("method") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      pipelineRunId: searchParams.get("pipelineRunId") ?? undefined,
      runId: searchParams.get("runId") ?? undefined,
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<GlobalFilters>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([key, value]) => {
          if (value === undefined || value === "") {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        });
        return next;
      });
    },
    [setSearchParams],
  );

  return { filters, setFilters };
}

export function formatDateRange(from?: string, to?: string): string {
  if (!from && !to) return "";
  if (from && to && from === to) return from;
  if (from && to) return `${from} → ${to}`;
  return from ?? to ?? "";
}
