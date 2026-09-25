import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
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

import { formatCstDateTime, formatCstDate, formatCstTime } from "../utils/formatDate";

function formatTime(value?: string): string {
  return formatCstDateTime(value);
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
      <aside className="relative flex h-full w-full max-w-3xl lg:max-w-4xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
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
  const [copied, setCopied] = useState(false);
  const meta = rowToRunMeta(task as unknown as Record<string, string>);

  const handleCopy = () => {
    const text = `[ETL Failure Incident]
Pipeline: ${task.ConfigName || "Unknown"}
Task: ${task.TaskName || "Unknown"}
Site: ${task.SiteCode || "N/A"}${task.DataBaseName ? ` (${task.DataBaseName})` : ""}
Time (CST): ${formatTime(task.StartTime)}
Run ID: ${task.PipelineRunId || task.TaskId || ""}
Error:
${task.ErrorMessage || "No error message recorded."}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="rounded-xl border border-red-900/50 bg-red-950/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-slate-100">{task.TaskName || "Unknown task"}</h4>
          <StatusBadge status={task.Status} />
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          title="Copy incident details for Jira or Teams"
        >
          {copied ? (
            <>
              <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Error</span>
            </>
          )}
        </button>
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

import { TablePaginationBar } from "./TablePaginationBar";

function formatFailureIncident(task: FailedTask): string {
  return `[ETL Failure Incident]
Pipeline: ${task.ConfigName || "Unknown"}
Task: ${task.TaskName || "Unknown"}
Site: ${task.SiteCode || "N/A"}${task.DataBaseName ? ` (${task.DataBaseName})` : ""}
Time (CST): ${formatTime(task.StartTime)}
Run ID: ${task.PipelineRunId || task.TaskId || ""}
Error:
${task.ErrorMessage || "No error message recorded."}`;
}

function FailureTableRow({ task }: { task: FailedTask }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = rowToRunMeta(task as unknown as Record<string, string>);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatFailureIncident(task));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer hover:bg-slate-800/60 transition-colors"
        title="Click to toggle full error traceback"
      >
        <td className="whitespace-nowrap px-3 py-2 text-slate-300 font-mono text-[11px] leading-tight">
          <div className="font-medium text-slate-200">{formatCstDate(task.StartTime)}</div>
          <div className="text-[10px] text-slate-400">{formatCstTime(task.StartTime)}</div>
        </td>
        <td className="max-w-[130px] truncate px-3 py-2 text-slate-200" title={task.ConfigName}>
          {task.ConfigName}
        </td>
        <td className="max-w-[130px] truncate px-3 py-2 font-medium text-slate-300" title={task.TaskName}>
          {task.TaskName}
        </td>
        <td className="max-w-[220px] truncate px-3 py-2 text-red-300/90 text-[11px]" title={task.ErrorMessage}>
          {task.ErrorMessage || "—"}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center justify-end gap-1.5">
            {task.ErrorMessage && (
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                title="Copy incident error text"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            )}
            {task.PipelineRunId && (
              <Link
                to={`/runs?pipelineRunId=${encodeURIComponent(task.PipelineRunId)}`}
                className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[11px] text-sky-400 hover:underline"
              >
                Run
              </Link>
            )}
            <FabricLink url={task.fabricUrl} meta={meta} label="Fabric" />
          </div>
        </td>
      </tr>
      {expanded && task.ErrorMessage && (
        <tr className="bg-red-950/20">
          <td colSpan={5} className="px-3 py-2.5">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                Full Error Traceback
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white"
              >
                {copied ? "✓ Copied to Clipboard" : "Copy Error"}
              </button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950/90 p-2 text-[11px] font-mono leading-relaxed text-red-200 border border-red-900/40">
              {task.ErrorMessage}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function SiteFailuresDrawer({ site, queryFilters, dateLabel, onClose }: SiteFailuresDrawerProps) {
  const open = !!site;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [site?.SiteCode]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["failedTasks", "drawer", site?.SiteCode, queryFilters],
    queryFn: () =>
      api.failedTasks({
        ...queryFilters,
        siteCode: site!.SiteCode,
        limit: 500,
        offset: 0,
      }),
    enabled: open,
  });

  const failures = (data?.failures ?? []) as FailedTask[];
  const title = site ? `${site.SiteCode}${site.SiteName ? ` — ${site.SiteName}` : ""}` : "";

  const isAll = pageSize === -1;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(failures.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedFailures = isAll
    ? failures
    : failures.slice((safePage - 1) * pageSize, safePage * pageSize);

  const copyAllErrors = () => {
    if (failures.length === 0) return;
    const allText = failures
      .map((t, idx) => `=== Failure ${idx + 1} of ${failures.length} ===\n${formatFailureIncident(t)}`)
      .join("\n\n");
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

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

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <p className="text-xs text-slate-400">
              {failures.length} failed Bronze task{failures.length === 1 ? "" : "s"} in {dateLabel}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {failures.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={copyAllErrors}
                    className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                    title="Copy all failed task errors for this site"
                  >
                    {copiedAll ? "✓ Copied All" : `Copy All (${failures.length})`}
                  </button>

                  <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={`rounded px-2 py-0.5 ${viewMode === "table" ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("cards")}
                      className={`rounded px-2 py-0.5 ${viewMode === "cards" ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Cards
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {isLoading && <p className="text-sm text-slate-400">Loading failures…</p>}
          {isError && <p className="text-sm text-red-300">Could not load failure details.</p>}
          {!isLoading && !isError && failures.length === 0 && (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
              No failures for this site in the selected range.
            </p>
          )}

          {!isLoading && failures.length > 0 && (
            <>
              {/* Top Drawer Pagination */}
              <TablePaginationBar
                page={safePage}
                totalPages={totalPages}
                totalItems={failures.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 25, 50, -1]}
                label="failures"
              />

              {viewMode === "table" ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-400 font-medium">
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">When</th>
                        <th className="px-3 py-2">Pipeline</th>
                        <th className="px-3 py-2">Task</th>
                        <th className="px-3 py-2">Error</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {pagedFailures.map((task) => (
                        <FailureTableRow key={`${task.TaskId}-${task.StartTime}`} task={task} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {pagedFailures.map((task) => (
                    <FailureCard key={`${task.TaskId}-${task.StartTime}`} task={task} />
                  ))}
                </div>
              )}

              {/* Bottom Drawer Pagination */}
              <TablePaginationBar
                page={safePage}
                totalPages={totalPages}
                totalItems={failures.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 25, 50, -1]}
                label="failures"
              />
            </>
          )}
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
