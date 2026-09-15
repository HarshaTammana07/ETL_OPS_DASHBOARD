import type { GlobalFilters } from "../types";

export interface FilterContext {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
}

/** KPI cards should not shrink when a status filter from a card click is active. */
export function kpiQueryFilters(filters: GlobalFilters): GlobalFilters {
  const { status: _status, targetName: _target, ...rest } = filters;
  return rest;
}

export function isBronzeFailedFilter(filters: GlobalFilters): boolean {
  return filters.status === "FAILED" && filters.targetName === "BR";
}

export function tableFilterLabel(filters: GlobalFilters): string | null {
  if (isBronzeFailedFilter(filters)) return "Failed bronze";
  if (filters.status === "SUCCESS") return "Successful";
  if (filters.status === "FAILED") return "Failed";
  if (filters.status === "RUNNING") return "Running";
  return null;
}
