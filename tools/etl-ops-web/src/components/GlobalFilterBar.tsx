import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "../api/client";
import type { GlobalFilters } from "../types";
import { DateField } from "./DateField";
import { PipelineFilter } from "./PipelineFilter";

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
}

function offsetDateStr(baseIso: string, offsetDays: number): string {
  const parts = baseIso.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return date.toISOString().slice(0, 10);
}

export function GlobalFilterBar({ filters, setFilters }: GlobalFilterBarProps) {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: api.health });

  const defaultTo = health?.defaultRefDate ?? new Date().toISOString().slice(0, 10);
  const startTo = filters.startDateTo ?? filters.refDate ?? defaultTo;
  const startFrom = filters.startDateFrom ?? startTo;

  const yesterday = offsetDateStr(defaultTo, -1);
  const last3Start = offsetDateStr(defaultTo, -2);
  const last7Start = offsetDateStr(defaultTo, -6);

  let activePreset: "today" | "yesterday" | "last3" | "last7" | "custom" = "custom";
  if (startFrom === defaultTo && startTo === defaultTo) {
    activePreset = "today";
  } else if (startFrom === yesterday && startTo === yesterday) {
    activePreset = "yesterday";
  } else if (startFrom === last3Start && startTo === defaultTo) {
    activePreset = "last3";
  } else if (startFrom === last7Start && startTo === defaultTo) {
    activePreset = "last7";
  }

  const applyPreset = (preset: "today" | "yesterday" | "last3" | "last7") => {
    let from = defaultTo;
    let to = defaultTo;
    if (preset === "yesterday") {
      from = yesterday;
      to = yesterday;
    } else if (preset === "last3") {
      from = last3Start;
      to = defaultTo;
    } else if (preset === "last7") {
      from = last7Start;
      to = defaultTo;
    }
    setFilters({
      startDateFrom: from,
      startDateTo: to,
      refDate: undefined,
      lookbackDays: undefined,
    });
  };

  const setStartFrom = (value: string) => {
    const patch: Partial<GlobalFilters> = { startDateFrom: value || undefined, refDate: undefined, lookbackDays: undefined };
    if (value && startTo && value > startTo) {
      patch.startDateTo = value;
    }
    setFilters(patch);
  };

  const setStartTo = (value: string) => {
    const patch: Partial<GlobalFilters> = { startDateTo: value || undefined, refDate: undefined, lookbackDays: undefined };
    if (value && startFrom && value < startFrom) {
      patch.startDateFrom = value;
    }
    setFilters(patch);
  };

  const resetFilters = () => {
    setFilters({
      startDateFrom: defaultTo,
      startDateTo: defaultTo,
      refDate: undefined,
      lookbackDays: undefined,
      configName: undefined,
      targetName: undefined,
      siteCode: undefined,
      status: undefined,
    });
  };

  const isFiltered = Boolean(
    filters.configName ||
      filters.targetName ||
      filters.status ||
      filters.siteCode ||
      (filters.startDateFrom && filters.startDateFrom !== defaultTo) ||
      (filters.startDateTo && filters.startDateTo !== defaultTo)
  );

  return (
    <div className="space-y-2.5">
      {/* Primary filters: Quick Presets + Date Range + Pipeline + Layer */}
      <div className="flex flex-wrap items-end gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        {/* Quick Date Presets */}
        <div className="flex flex-col gap-1 text-xs text-slate-400">
          <span>Quick Presets</span>
          <div className="inline-flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className={clsx(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activePreset === "today"
                  ? "bg-sky-600 font-semibold text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset("yesterday")}
              className={clsx(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activePreset === "yesterday"
                  ? "bg-sky-600 font-semibold text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => applyPreset("last3")}
              className={clsx(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activePreset === "last3"
                  ? "bg-sky-600 font-semibold text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              Last 3 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset("last7")}
              className={clsx(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activePreset === "last7"
                  ? "bg-sky-600 font-semibold text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              Last 7 Days
            </button>
          </div>
        </div>

        {/* Custom From Date */}
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          From
          <DateField
            value={startFrom}
            min={health?.dataBounds.minDate ?? undefined}
            max={health?.dataBounds.maxDate ?? undefined}
            onChange={setStartFrom}
          />
        </label>

        {/* Custom To Date */}
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          To
          <DateField
            value={startTo}
            min={health?.dataBounds.minDate ?? undefined}
            max={health?.dataBounds.maxDate ?? undefined}
            onChange={setStartTo}
          />
        </label>

        {/* Pipeline Filter */}
        <label className="flex min-w-[180px] flex-col gap-1 text-xs text-slate-400">
          Pipeline
          <PipelineFilter value={filters.configName} onChange={(configName) => setFilters({ configName })} />
        </label>

        {/* Layer Filter */}
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Layer
          <select
            value={filters.targetName ?? ""}
            onChange={(e) => setFilters({ targetName: (e.target.value || undefined) as GlobalFilters["targetName"] })}
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="BR">Bronze</option>
            <option value="SL">Silver</option>
            <option value="GL">Gold</option>
          </select>
        </label>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex h-9 items-center gap-1 self-end rounded-md border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Reset all filters to default"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
