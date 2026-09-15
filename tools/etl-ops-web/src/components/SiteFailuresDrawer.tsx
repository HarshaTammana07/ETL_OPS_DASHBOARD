import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "./FabricLink";
import { StatusBadge } from "./StatusBadge";
import type { FailedTask, GlobalFilters } from "../types";

export interface SiteSummaryMeta {
  SiteCode: string;
  SiteName?: string;
  DataBaseName?: string;
  failure_count?: number;
  pipeline_count?: number;
  last_failure?: string;
}

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
  });
}

function useDrawerLock(open: boolean, onClose: () => void) {
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
}

function DrawerShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  useDrawerLock(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{subtitle ?? "Details"}</p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-50">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

function FailureCard({ task }: { task: FailedTask }) {
  const meta = rowToRunMeta(task as unknown as Record<string, string>);
  return (
    <article className="rounded-xl border border-red-900/50 bg-red-950/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium text-slate-100">{task.TaskName || "Unknown task"}</h4>
        <StatusBadge status={task.Status} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {task.ConfigName && <span>{task.ConfigName} · </span>}
        {task.TargetTable && <span>{task.TargetTable} · </span>}
        {task.StartTime && <span>{formatTime(task.StartTime)}</span>}
      </p>
      {task.ErrorMessage ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/80 p-3 text-[12px] leading-relaxed text-red-100/90">
          {task.ErrorMessage}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No error message recorded.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {task.PipelineRunId && (
          <Link
            to={`/runs?pipelineRunId=${encodeURIComponent(task.PipelineRunId)}`}
            className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-slate-700"
          >
            Run Explorer
          </Link>
        )}
        <FabricLink url={task.fabricUrl} meta={meta} label="Fabric" />
      </div>
    </article>
  );
}

interface SiteFailuresDrawerProps {
  site: SiteSummaryMeta | null;
  queryFilters: GlobalFilters;
  dateLabel: string;
  onClose: () => void;
}

export function SiteFailuresDrawer({ site, queryFilters, dateLabel, onClose }: SiteFailuresDrawerProps) {
  const open = !!site;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["failedTasks", "drawer", site?.SiteCode, queryFilters],
    queryFn: () =>
      api.failedTasks({
        ...queryFilters,
        siteCode: site!.SiteCode,
        limit: 100,
        offset: 0,
      }),
    enabled: open,
  });

  const failures = (data?.failures ?? []) as FailedTask[];
  const title = site ? `${site.SiteCode}${site.SiteName ? ` — ${site.SiteName}` : ""}` : "";

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Bronze site failures"
      ariaLabel={`Failures for site ${site?.SiteCode ?? ""}`}
    >
      {site && (
        <div className="space-y-4">
          <section className="grid gap-2 sm:grid-cols-2">
            {[
              ["Database", site.DataBaseName],
              ["Failures", site.failure_count?.toString()],
              ["Pipelines", site.pipeline_count?.toString()],
              ["Last failure", site.last_failure ? formatTime(site.last_failure) : undefined],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-sm text-slate-200">{value}</p>
                </div>
              ) : null,
            )}
          </section>

          <p className="text-xs text-slate-500">
            {failures.length} failed Bronze task{failures.length === 1 ? "" : "s"} in {dateLabel}
          </p>

          {isLoading && <p className="text-sm text-slate-400">Loading failures…</p>}
          {isError && <p className="text-sm text-red-300">Could not load failure details.</p>}
          {!isLoading && !isError && failures.length === 0 && (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
              No failures for this site in the selected range.
            </p>
          )}

          <div className="space-y-3">
            {failures.map((task) => (
              <FailureCard key={`${task.TaskId}-${task.StartTime}`} task={task} />
            ))}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

interface FailureDetailDrawerProps {
  task: FailedTask | null;
  onClose: () => void;
}

/** Single failed task — opened from the all-failures table row click. */
export function FailureDetailDrawer({ task, onClose }: FailureDetailDrawerProps) {
  const open = !!task;

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={task?.TaskName || "Failed task"}
      subtitle={task?.ConfigName || "Bronze failure"}
      ariaLabel="Failed task details"
    >
      {task && (
        <div className="space-y-4">
          <section className="grid gap-2 sm:grid-cols-2">
            {[
              ["Site", task.SiteCode],
              ["Database", task.DataBaseName],
              ["Site name", task.SiteName],
              ["Target table", task.TargetTable],
              ["When", task.StartTime ? formatTime(task.StartTime) : undefined],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm text-slate-200">{value}</p>
                </div>
              ) : null,
            )}
          </section>
          <FailureCard task={task} />
        </div>
      )}
    </DrawerShell>
  );
}
