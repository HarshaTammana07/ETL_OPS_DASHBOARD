import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { buildTrendsHref } from "./TrendsScopeBar";
import type { RunMeta } from "./FabricLink";
import { FabricLink } from "./FabricLink";
import { LayerBadge, StatusBadge } from "./StatusBadge";

function formatTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19).replace("T", " ");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface RunDetailsDrawerProps {
  meta: RunMeta | null;
  onClose: () => void;
}

export function RunDetailsDrawer({ meta, onClose }: RunDetailsDrawerProps) {
  const open = !!meta;

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["runTasks", meta?.RunId, meta?.PipelineRunId, meta?.ConfigId],
    queryFn: () =>
      api.runTasks(meta!.RunId || meta!.PipelineRunId!, {
        pipelineRunId: meta!.PipelineRunId,
        configId: meta!.ConfigId,
      }),
    enabled: open && !!(meta?.RunId || meta?.PipelineRunId),
  });

  if (!meta) return null;

  const tasks = data?.tasks ?? [];
  const failed = tasks.filter((t) => t.Status === "FAILED");
  const succeeded = tasks.filter((t) => t.Status === "SUCCESS");
  const other = tasks.filter((t) => t.Status !== "FAILED" && t.Status !== "SUCCESS");

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end" role="dialog" aria-modal="true" aria-label="Run details">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expanded run card</p>
            <h2 className="truncate text-lg font-semibold text-slate-50">{meta.ConfigName || "Run details"}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {meta.TargetName && <LayerBadge layer={meta.TargetName} />}
              {meta.Status && <StatusBadge status={meta.Status} />}
              {meta.StartTime && <span className="text-xs text-slate-400">{formatTime(meta.StartTime)}</span>}
              {meta.EndTime && <span className="text-xs text-slate-500">→ {formatTime(meta.EndTime)}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="grid gap-3 sm:grid-cols-2">
            {[
              ["Pipeline run ID", meta.PipelineRunId],
              ["Run ID", meta.RunId],
              ["Config ID", meta.ConfigId],
              ["Fabric pipeline", meta.PipelineName],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-200">{value}</p>
                </div>
              ) : null,
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {meta.PipelineRunId && (
              <Link
                to={buildTrendsHref({ pipelineRunId: meta.PipelineRunId })}
                className="rounded-lg bg-sky-900/50 px-3 py-1.5 text-xs text-sky-200 ring-1 ring-sky-700/50 hover:bg-sky-900"
                onClick={onClose}
              >
                View trends (all layers)
              </Link>
            )}
            {meta.RunId && (
              <Link
                to={buildTrendsHref({ runId: meta.RunId })}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-sky-300 hover:bg-slate-700"
                onClick={onClose}
              >
                View trends (this layer)
              </Link>
            )}
            {meta.PipelineRunId && (
              <Link
                to={`/runs?pipelineRunId=${encodeURIComponent(meta.PipelineRunId)}`}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-sky-300 hover:bg-slate-700"
                onClick={onClose}
              >
                Open in Run Explorer
              </Link>
            )}
            <FabricLink url={meta.fabricUrl} meta={meta} label="Open in Fabric" />
          </div>

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Task audit</h3>
              <p className="text-[11px] text-slate-500">
                {failed.length} failed · {succeeded.length} success
                {other.length ? ` · ${other.length} other` : ""}
              </p>
            </div>

            {isLoading && <p className="text-sm text-slate-400">Loading taskaudit…</p>}
            {isError && <p className="text-sm text-red-300">Could not load task details.</p>}
            {!isLoading && !isError && tasks.length === 0 && (
              <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
                No taskaudit / taskqueue rows found for this run.
              </p>
            )}

            {failed.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[11px] font-medium text-red-300">Failed tasks & errors</p>
                {failed.map((task, i) => (
                  <article key={`f-${i}`} className="rounded-xl border border-red-900/50 bg-red-950/25 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-100">{task.TaskName}</h4>
                      <StatusBadge status={task.Status} />
                      {task.SiteCode && (
                        <span className="rounded bg-sky-950/50 px-1.5 py-0.5 text-[11px] text-sky-300">{task.SiteCode}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {task.DataBaseName && <span>{task.DataBaseName} · </span>}
                      {task.TableName && <span>{task.TableName} · </span>}
                      rows {task.RowsRead || "0"} → {task.RowsWritten || "0"}
                      {task.RowsFailed ? ` · failed rows ${task.RowsFailed}` : ""}
                      {task.StartTime ? ` · ${formatTime(task.StartTime)}` : ""}
                    </p>
                    {task.ErrorMessage ? (
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/80 p-3 text-[12px] leading-relaxed text-red-100/90">
                        {task.ErrorMessage}
                      </pre>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No ErrorMessage in taskaudit for this task.</p>
                    )}
                  </article>
                ))}
              </div>
            )}

            {succeeded.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-emerald-300">Successful tasks (row counts)</p>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Task</th>
                        <th className="px-3 py-2 font-medium">Site</th>
                        <th className="px-3 py-2 font-medium">Database</th>
                        <th className="px-3 py-2 font-medium text-right">Read</th>
                        <th className="px-3 py-2 font-medium text-right">Written</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {succeeded.slice(0, 40).map((task, i) => (
                        <tr key={`s-${i}`} className="hover:bg-slate-900/60">
                          <td className="max-w-[200px] truncate px-3 py-1.5 text-slate-200" title={task.TaskName}>
                            {task.TaskName}
                          </td>
                          <td className="px-3 py-1.5 text-sky-300">{task.SiteCode || "—"}</td>
                          <td className="max-w-[160px] truncate px-3 py-1.5 text-slate-400">{task.DataBaseName || "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{task.RowsRead || "0"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{task.RowsWritten || "0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {succeeded.length > 40 && (
                    <p className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
                      Showing 40 of {succeeded.length} successful tasks
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
