import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { GlobalFilters } from "../types";
import { DateField } from "./DateField";
import { PipelineFilter } from "./PipelineFilter";

interface GlobalFilterBarProps {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
}

export function GlobalFilterBar({ filters, setFilters }: GlobalFilterBarProps) {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: api.health });

  const defaultTo = health?.defaultRefDate ?? "";
  const startTo = filters.startDateTo ?? filters.refDate ?? defaultTo;
  const startFrom = filters.startDateFrom ?? startTo;

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

  return (
    <div className="space-y-2.5">
      {/* Primary filters: Date range + Pipeline + Layer */}
      <div className="flex flex-wrap items-end gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          From
          <DateField
            value={startFrom}
            min={health?.dataBounds.minDate ?? undefined}
            max={health?.dataBounds.maxDate ?? undefined}
            onChange={setStartFrom}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          To
          <DateField
            value={startTo}
            min={health?.dataBounds.minDate ?? undefined}
            max={health?.dataBounds.maxDate ?? undefined}
            onChange={setStartTo}
          />
        </label>

        <label className="flex min-w-[180px] flex-col gap-1 text-xs text-slate-400">
          Pipeline
          <PipelineFilter value={filters.configName} onChange={(configName) => setFilters({ configName })} />
        </label>

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
      </div>
    </div>
  );
}
