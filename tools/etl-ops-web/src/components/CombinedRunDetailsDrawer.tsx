import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { CstTimeBadge } from "./CstTimeBadge";
import { LayerBadge, StatusBadge } from "./StatusBadge";
import type { PipelineRun } from "../types";

interface CombinedRunDetailsDrawerProps {
  pipelineRunId: string | null;
  runs: PipelineRun[] | null;
  onClose: () => void;
}

interface AggregatedTask {
  taskName: string;
  siteCode: string;
  databaseName: string;
  totalRowsRead: number;
  totalRowsWritten: number;
  successCount: number;
  failedCount: number;
  layers: string[];
  lastStartTime: string;
}

function aggregateTasks(runs: PipelineRun[]): AggregatedTask[] {
  const taskMap = new Map<string, AggregatedTask>();

  // Fetch task details for each run
  for (const run of runs) {
    // For now, we'll create a simple aggregation based on available run data
    // The actual task details would come from the taskaudit API call
  }

  return Array.from(taskMap.values());
}

export function CombinedRunDetailsDrawer({
  pipelineRunId,
  runs,
  onClose,
}: CombinedRunDetailsDrawerProps) {
  const open = !!pipelineRunId && !!runs;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !runs) return null;

  const pipelineName = runs[0]?.ConfigName || runs[0]?.PipelineName || "Unknown";
  const totalLayers = runs.length;
  const allSuccessful = runs.every((r) => r.Status === "SUCCESS");
  const totalFailedTasks = runs.reduce(
    (sum, r) => sum + (parseInt(r.FailedTasks || "0", 10) || 0),
    0
  );

  const sortedRuns = [...runs].sort((a, b) => {
    const orderA = a.TargetName === "BR" || a.TargetName === "BRZ" ? 1 : a.TargetName === "SL" ? 2 : 3;
    const orderB = b.TargetName === "BR" || b.TargetName === "BRZ" ? 1 : b.TargetName === "SL" ? 2 : 3;
    return orderA - orderB;
  });

  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      onClick={onClose}
    >
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700 transition-transform overflow-y-auto ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900/95 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{pipelineName}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Pipeline Run ID: <code className="text-slate-300">{pipelineRunId}</code>
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Total Layers</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">{totalLayers}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Overall Status</div>
              <div className="mt-1">
                <StatusBadge status={allSuccessful ? "SUCCESS" : totalFailedTasks > 0 ? "FAILED" : "RUNNING"} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Failed Tasks</div>
              <div className={`text-2xl font-bold mt-1 ${totalFailedTasks > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {totalFailedTasks}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Total Tasks</div>
              <div className="text-2xl font-bold text-slate-100 mt-1">
                {sortedRuns.reduce((sum, r) => sum + (parseInt(r.TotalTasks || "0", 10) || 0), 0)}
              </div>
            </div>
          </div>

          {/* Layers Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Layer Breakdown</h3>
            <div className="space-y-2">
              {sortedRuns.map((run) => (
                <div
                  key={`${run.PipelineRunId}-${run.TargetName}`}
                  className={`rounded-lg border p-3 ${
                    run.TargetName === "BR" || run.TargetName === "BRZ"
                      ? "border-orange-500/30 bg-orange-500/5"
                      : run.TargetName === "SL"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-emerald-500/30 bg-emerald-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <LayerBadge layer={run.TargetName} />
                      <div>
                        <div className="text-sm font-medium text-slate-200">
                          {run.TargetName === "BR" || run.TargetName === "BRZ"
                            ? "Bronze"
                            : run.TargetName === "SL"
                              ? "Silver"
                              : "Gold"}
                        </div>
                        <div className="mt-1">
                          <CstTimeBadge time={run.StartTime} mode="short" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <StatusBadge status={run.Status} />
                        <div className="text-xs text-slate-400 mt-1">
                          {run.SuccessTasks || 0}/{run.TotalTasks || 0} tasks
                        </div>
                      </div>
                      {parseInt(run.FailedTasks || "0", 10) > 0 && (
                        <span className="text-xs font-medium text-red-400 whitespace-nowrap">
                          {run.FailedTasks} failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combined Task Summary */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Combined Task Metrics</h3>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">Metric</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-300">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-400">Total Success Tasks</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                      {sortedRuns.reduce((sum, r) => sum + (parseInt(r.SuccessTasks || "0", 10) || 0), 0)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-400">Total Failed Tasks</td>
                    <td className="px-3 py-2 text-right text-red-400 font-medium">
                      {totalFailedTasks}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-400">Total Tasks Executed</td>
                    <td className="px-3 py-2 text-right text-slate-200 font-medium">
                      {sortedRuns.reduce((sum, r) => sum + (parseInt(r.TotalTasks || "0", 10) || 0), 0)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 bg-slate-800/20">
                    <td className="px-3 py-2 font-medium text-slate-300">Success Rate</td>
                    <td className="px-3 py-2 text-right text-slate-200 font-bold">
                      {(() => {
                        const total = sortedRuns.reduce((sum, r) => sum + (parseInt(r.TotalTasks || "0", 10) || 0), 0);
                        const success = sortedRuns.reduce((sum, r) => sum + (parseInt(r.SuccessTasks || "0", 10) || 0), 0);
                        return total > 0 ? `${((success / total) * 100).toFixed(1)}%` : "—";
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Info text */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3 text-xs text-slate-400">
            <p>
              This view combines task audit data from all layers in this pipeline run.
              For detailed task-level information, click <span className="text-slate-300 font-medium">Details</span> on
              individual layers.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
