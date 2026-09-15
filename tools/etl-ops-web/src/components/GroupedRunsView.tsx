import { useState } from "react";
import clsx from "clsx";
import { LayerBadge, StatusBadge } from "./StatusBadge";
import type { PipelineRun } from "../types";

interface GroupedRunsViewProps {
  runs: PipelineRun[];
  onExpandRun?: (run: PipelineRun) => void;
  onExpandGroupDetails?: (pipelineRunId: string, runs: PipelineRun[]) => void;
  emptyMessage?: string;
}

interface GroupedRun {
  pipelineRunId: string;
  configName: string;
  pipelineName: string;
  startTime: string;
  layers: PipelineRun[];
  overallStatus: "SUCCESS" | "FAILED" | "RUNNING" | "MIXED";
}

function groupRunsByPipelineId(runs: PipelineRun[]): GroupedRun[] {
  const grouped = new Map<string, GroupedRun>();

  for (const run of runs) {
    const key = run.PipelineRunId || run.RunId || "";
    if (!key) continue;

    if (!grouped.has(key)) {
      grouped.set(key, {
        pipelineRunId: key,
        configName: run.ConfigName,
        pipelineName: run.PipelineName || run.ConfigName,
        startTime: run.StartTime,
        layers: [],
        overallStatus: "SUCCESS",
      });
    }

    const group = grouped.get(key)!;
    group.layers.push(run);

    // Calculate overall status
    const statuses = group.layers.map((r) => r.Status);
    if (statuses.some((s) => s === "FAILED")) {
      group.overallStatus = "FAILED";
    } else if (statuses.some((s) => s === "RUNNING")) {
      if (group.overallStatus !== "FAILED") {
        group.overallStatus = "RUNNING";
      }
    } else if (statuses.every((s) => s === "SUCCESS")) {
      group.overallStatus = "SUCCESS";
    } else {
      group.overallStatus = "MIXED";
    }
  }

  return Array.from(grouped.values());
}

function getLayerOrder(targetName: string | undefined): number {
  switch (targetName) {
    case "BR":
    case "BRZ":
      return 1;
    case "SL":
      return 2;
    case "GL":
      return 3;
    default:
      return 99;
  }
}

export function GroupedRunsView({ runs, onExpandRun, onExpandGroupDetails, emptyMessage }: GroupedRunsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!runs || runs.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-slate-400">
        {emptyMessage || "No runs found"}
      </div>
    );
  }

  const groupedRuns = groupRunsByPipelineId(runs);

  const toggleExpanded = (pipelineRunId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(pipelineRunId)) {
      newExpanded.delete(pipelineRunId);
    } else {
      newExpanded.add(pipelineRunId);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
      {groupedRuns.map((group) => {
        const isExpanded = expandedIds.has(group.pipelineRunId);
        const sortedLayers = [...group.layers].sort((a, b) =>
          getLayerOrder(a.TargetName) - getLayerOrder(b.TargetName)
        );
        const totalFailedTasks = group.layers.reduce(
          (sum, r) => sum + (parseInt(r.FailedTasks, 10) || 0),
          0
        );

        return (
          <div key={group.pipelineRunId}>
            {/* Group Header */}
            <div
              onClick={() => toggleExpanded(group.pipelineRunId)}
              className="cursor-pointer border-b border-slate-800 px-4 py-3 hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Expand toggle */}
                  <div className="text-slate-500 text-sm">
                    {isExpanded ? "▼" : "▶"}
                  </div>

                  {/* Pipeline name */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-slate-100 truncate">
                      {group.pipelineName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Run ID: {group.pipelineRunId} • {group.startTime}
                    </p>
                  </div>
                </div>

                {/* Status summary and actions */}
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <StatusBadge status={group.overallStatus} />
                  {totalFailedTasks > 0 && (
                    <span className="text-xs font-medium text-red-400">
                      {totalFailedTasks} failed task{totalFailedTasks > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {sortedLayers.length} layer{sortedLayers.length > 1 ? "s" : ""}
                  </span>
                  {onExpandGroupDetails && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpandGroupDetails(group.pipelineRunId, group.layers);
                      }}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/10 transition whitespace-nowrap"
                      title="View combined details for all layers"
                    >
                      📊 Combined
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded content - Layer breakdown */}
            {isExpanded && (
              <div className="bg-slate-950/50 border-t border-slate-800">
                {sortedLayers.map((layer, idx) => (
                  <div
                    key={`${layer.PipelineRunId}-${layer.TargetName}`}
                    className={clsx(
                      "px-6 py-2.5 border-l-4 text-sm",
                      layer.TargetName === "BR" || layer.TargetName === "BRZ"
                        ? "border-l-orange-500/50 bg-orange-500/5"
                        : layer.TargetName === "SL"
                          ? "border-l-blue-500/50 bg-blue-500/5"
                          : "border-l-emerald-500/50 bg-emerald-500/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <LayerBadge layer={layer.TargetName} />
                        <span className="text-slate-300">{layer.TargetName === "BR" || layer.TargetName === "BRZ" ? "Bronze" : layer.TargetName === "SL" ? "Silver" : "Gold"}</span>
                      </div>

                      <div className="flex items-center gap-4 whitespace-nowrap">
                        <StatusBadge status={layer.Status} />
                        {layer.FailedTasks !== "0" && (
                          <span className="text-xs font-medium text-red-400">
                            {layer.FailedTasks} failed
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {layer.StartTime}
                        </span>
                        {onExpandRun && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExpandRun(layer);
                            }}
                            className="text-xs font-medium text-sky-400 hover:text-sky-300 px-2.5 py-1 rounded border border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/10 transition whitespace-nowrap"
                            title={`View details for ${layer.TargetName || "layer"}`}
                          >
                            👁️ Details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
