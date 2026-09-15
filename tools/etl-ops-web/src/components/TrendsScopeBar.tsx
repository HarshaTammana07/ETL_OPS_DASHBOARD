import { useEffect, useState } from "react";
import type { GlobalFilters } from "../types";
import { formatDateRange } from "../hooks/useGlobalFilters";

const LAYER_LABELS: Record<string, string> = {
  BR: "Bronze",
  SL: "Silver",
  GL: "Gold",
};

export function buildTrendsHref(filters: Partial<GlobalFilters>): string {
  const params = new URLSearchParams();
  if (filters.pipelineRunId) params.set("pipelineRunId", filters.pipelineRunId);
  if (filters.runId) params.set("runId", filters.runId);
  if (filters.configName) params.set("configName", filters.configName);
  if (filters.targetName) params.set("targetName", filters.targetName);
  if (filters.startDateFrom) params.set("startDateFrom", filters.startDateFrom);
  if (filters.startDateTo) params.set("startDateTo", filters.startDateTo);
  if (filters.siteCode) params.set("siteCode", filters.siteCode);
  const qs = params.toString();
  return qs ? `/trends?${qs}` : "/trends";
}

export function trendsScopeLabel(filters: GlobalFilters): string {
  if (filters.pipelineRunId && !filters.runId) {
    return `Parent run ${filters.pipelineRunId.slice(0, 8)}…`;
  }
  if (filters.runId) {
    return `Layer run ${filters.runId}`;
  }
  const parts: string[] = [];
  const dates = formatDateRange(filters.startDateFrom, filters.startDateTo);
  if (dates) parts.push(dates);
  if (filters.configName) parts.push(`Pipeline: ${filters.configName}`);
  if (filters.targetName) parts.push(LAYER_LABELS[filters.targetName] ?? filters.targetName);
  if (filters.siteCode) parts.push(`Site: ${filters.siteCode}`);
  return parts.length ? parts.join(" · ") : "All pipelines in date window";
}

export function isRunScoped(filters: GlobalFilters): boolean {
  return !!(filters.pipelineRunId || filters.runId);
}

interface ScopeChip {
  key: string;
  label: string;
  onClear: () => void;
}

export function activeScopeChips(filters: GlobalFilters, setFilters: (p: Partial<GlobalFilters>) => void): ScopeChip[] {
  const chips: ScopeChip[] = [];

  if (filters.pipelineRunId) {
    chips.push({
      key: "pipelineRunId",
      label: `Parent run: ${filters.pipelineRunId.length > 20 ? `${filters.pipelineRunId.slice(0, 20)}…` : filters.pipelineRunId}`,
      onClear: () => setFilters({ pipelineRunId: undefined }),
    });
  }
  if (filters.runId) {
    chips.push({
      key: "runId",
      label: `Layer run: ${filters.runId}`,
      onClear: () => setFilters({ runId: undefined }),
    });
  }
  if (filters.configName) {
    chips.push({
      key: "configName",
      label: `Pipeline: ${filters.configName}`,
      onClear: () => setFilters({ configName: undefined }),
    });
  }
  if (filters.targetName) {
    chips.push({
      key: "targetName",
      label: LAYER_LABELS[filters.targetName] ?? filters.targetName,
      onClear: () => setFilters({ targetName: undefined }),
    });
  }
  if (filters.siteCode) {
    chips.push({
      key: "siteCode",
      label: `Site: ${filters.siteCode}`,
      onClear: () => setFilters({ siteCode: undefined }),
    });
  }
  const dates = formatDateRange(filters.startDateFrom, filters.startDateTo);
  if (dates && !isRunScoped(filters)) {
    chips.push({
      key: "dates",
      label: `Dates: ${dates}`,
      onClear: () => setFilters({ startDateFrom: undefined, startDateTo: undefined, refDate: undefined }),
    });
  }

  return chips;
}

interface TrendsScopeBarProps {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
}

export function TrendsScopeBar({ filters, setFilters }: TrendsScopeBarProps) {
  const [runInput, setRunInput] = useState(filters.pipelineRunId ?? filters.runId ?? "");
  const [runMode, setRunMode] = useState<"parent" | "layer">(
    filters.runId && !filters.pipelineRunId ? "layer" : "parent",
  );
  const runScoped = isRunScoped(filters);
  const chips = activeScopeChips(filters, setFilters);

  useEffect(() => {
    setRunInput(filters.pipelineRunId ?? filters.runId ?? "");
    if (filters.runId && !filters.pipelineRunId) setRunMode("layer");
    else if (filters.pipelineRunId) setRunMode("parent");
  }, [filters.pipelineRunId, filters.runId]);

  const applyRunScope = () => {
    const value = runInput.trim();
    if (!value) return;
    if (runMode === "parent") {
      setFilters({ pipelineRunId: value, runId: undefined });
    } else {
      setFilters({ runId: value, pipelineRunId: undefined });
    }
  };

  const clearRunScope = () => {
    setRunInput("");
    setFilters({ pipelineRunId: undefined, runId: undefined });
  };

  const onRunKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") applyRunScope();
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active scope</span>
          <span className="truncate text-xs text-slate-300">{trendsScopeLabel(filters)}</span>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onClear}
                    className="rounded px-0.5 text-slate-500 hover:text-slate-200"
                    aria-label={`Remove ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {chips.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setFilters({
                pipelineRunId: undefined,
                runId: undefined,
                configName: undefined,
                targetName: undefined,
                siteCode: undefined,
              })
            }
            className="text-[11px] text-slate-400 hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Run ID search — always visible */}
      <div className="flex flex-wrap items-end gap-2 border-t border-slate-800 pt-2.5">
        <label className="flex flex-col gap-1 text-[10px] text-slate-500">
          Analyze by
          <select
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as "parent" | "layer")}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="parent">Pipeline Run ID (all layers)</option>
            <option value="layer">Run ID (single layer)</option>
          </select>
        </label>
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[10px] text-slate-500">
          {runMode === "parent" ? "Pipeline Run ID" : "Run ID"}
          <input
            value={runInput}
            onChange={(e) => setRunInput(e.target.value)}
            onKeyDown={onRunKeyDown}
            placeholder={
              runMode === "parent"
                ? "e.g. c3383bb1-b723-4b3e-bec7-f60bc8b15ae7"
                : "e.g. 202609081233579600"
            }
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={applyRunScope}
          disabled={!runInput.trim()}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Analyze run
        </button>
        {runScoped && (
          <button
            type="button"
            onClick={clearRunScope}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Back to date window
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Paste a Pipeline Run ID or Run ID from Home / Run Explorer — trends and KPIs will scope to that execution.
      </p>
    </div>
  );
}
