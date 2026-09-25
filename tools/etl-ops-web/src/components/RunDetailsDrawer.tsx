import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { buildTrendsHref } from "./TrendsScopeBar";
import type { RunMeta } from "./FabricLink";
import { CstTimeBadge } from "./CstTimeBadge";
import { FabricLink } from "./FabricLink";
import { LayerBadge, StatusBadge } from "./StatusBadge";
import { formatCstDateTime } from "../utils/formatDate";

function formatNumber(val?: string | number): string {
  if (val === undefined || val === null || val === "") return "0";
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toLocaleString();
}

interface RunDetailsDrawerProps {
  meta: RunMeta | null;
  onClose: () => void;
}

export function RunDetailsDrawer({ meta, onClose }: RunDetailsDrawerProps) {
  const open = !!meta;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FAILED" | "SUCCESS">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

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

  // Reset page and search when run changes
  useEffect(() => {
    setSearch("");
    setStatusFilter("ALL");
    setPage(1);
    setExpandedTaskId(null);
  }, [meta?.RunId, meta?.PipelineRunId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["runTasks", meta?.RunId, meta?.PipelineRunId, meta?.ConfigId],
    queryFn: () =>
      api.runTasks(meta!.RunId || meta!.PipelineRunId!, {
        pipelineRunId: meta!.PipelineRunId,
        configId: meta!.ConfigId,
        limit: 5000,
      }),
    enabled: open && !!(meta?.RunId || meta?.PipelineRunId),
  });

  const allTasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);

  const failedCount = useMemo(() => allTasks.filter((t) => t.Status === "FAILED").length, [allTasks]);
  const successCount = useMemo(() => allTasks.filter((t) => t.Status === "SUCCESS").length, [allTasks]);

  const copySingleError = (task: typeof allTasks[0]) => {
    const key = task.TaskId || task.TaskName || "unknown";
    const text = `[Task Failure Incident]
Pipeline: ${meta?.ConfigName || meta?.PipelineName || "Unknown"}
Task: ${task.TaskName || "Unknown"}
Site: ${task.SiteCode || "N/A"}${task.DataBaseName ? ` (${task.DataBaseName})` : ""}
Run ID: ${meta?.RunId || meta?.PipelineRunId || ""}
Error Message:
${task.ErrorMessage || "No error details recorded."}`;

    navigator.clipboard.writeText(text);
    setCopiedTaskId(key);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const copyAllErrors = () => {
    const failedTasks = allTasks.filter((t) => t.Status === "FAILED" || t.ErrorMessage);
    if (failedTasks.length === 0) return;

    const header = `[Pipeline Run Failures Summary]
Pipeline: ${meta?.ConfigName || meta?.PipelineName || "Unknown"}
Run ID: ${meta?.RunId || meta?.PipelineRunId || ""}
Failed Tasks: ${failedTasks.length} / ${allTasks.length}
============================================================\n`;

    const body = failedTasks
      .map((t, idx) => {
        return `${idx + 1}. Task: ${t.TaskName || "Unknown"}
   Site: ${t.SiteCode || "N/A"}${t.DataBaseName ? ` (${t.DataBaseName})` : ""}
   Error: ${t.ErrorMessage || "Failed without specific error message"}\n`;
      })
      .join("\n");

    navigator.clipboard.writeText(header + "\n" + body);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Filter tasks based on status and search query
  const filteredTasks = useMemo(() => {
    let list = allTasks;
    if (statusFilter === "FAILED") {
      list = list.filter((t) => t.Status === "FAILED");
    } else if (statusFilter === "SUCCESS") {
      list = list.filter((t) => t.Status === "SUCCESS");
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((t) => {
      const taskName = (t.TaskName || "").toLowerCase();
      const siteCode = (t.SiteCode || "").toLowerCase();
      const dbName = (t.DataBaseName || "").toLowerCase();
      const tableName = (t.TableName || "").toLowerCase();
      return (
        taskName.includes(q) ||
        siteCode.includes(q) ||
        dbName.includes(q) ||
        tableName.includes(q)
      );
    });
  }, [allTasks, statusFilter, search]);

  // Pagination calculation
  const totalItems = filteredTasks.length;
  const isAll = pageSize >= 5000;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = isAll ? 0 : (currentPage - 1) * pageSize;
  const endIndex = isAll ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const pagedTasks = useMemo(() => filteredTasks.slice(startIndex, endIndex), [filteredTasks, startIndex, endIndex]);

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  if (!meta) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end" role="dialog" aria-modal="true" aria-label="Run details">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-4xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900/90 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expanded run card</p>
            <h2 className="truncate text-lg font-semibold text-slate-50" title={meta.ConfigName || "Run details"}>
              {meta.ConfigName || "Run details"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {meta.TargetName && <LayerBadge layer={meta.TargetName} />}
              {meta.Status && <StatusBadge status={meta.Status} />}
              {meta.StartTime && <CstTimeBadge time={meta.StartTime} mode="short" />}
              {meta.EndTime && <span className="text-xs text-slate-500">→</span>}
              {meta.EndTime && <CstTimeBadge time={meta.EndTime} mode="timeOnly" subtle />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Metadata Cards */}
          <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Pipeline Run ID", meta.PipelineRunId],
              ["Run ID", meta.RunId],
              ["Config ID", meta.ConfigId],
              ["Fabric Pipeline", meta.PipelineName],
            ].map(([label, value]) =>
              value ? (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-200" title={value}>
                    {value}
                  </p>
                </div>
              ) : null,
            )}
          </section>

          {/* Quick Action Links */}
          <div className="flex flex-wrap items-center gap-2">
            {meta.PipelineRunId && (
              <Link
                to={buildTrendsHref({ pipelineRunId: meta.PipelineRunId })}
                className="rounded-lg bg-sky-900/40 px-3 py-1.5 text-xs font-medium text-sky-200 ring-1 ring-sky-700/50 hover:bg-sky-900/70"
                onClick={onClose}
              >
                View trends (all layers)
              </Link>
            )}
            {meta.RunId && (
              <Link
                to={buildTrendsHref({ runId: meta.RunId })}
                className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-slate-700 hover:text-white"
                onClick={onClose}
              >
                View trends (this layer)
              </Link>
            )}
            {meta.PipelineRunId && (
              <Link
                to={`/runs?pipelineRunId=${encodeURIComponent(meta.PipelineRunId)}`}
                className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-slate-700 hover:text-white"
                onClick={onClose}
              >
                Open in Run Explorer
              </Link>
            )}
            <FabricLink url={meta.fabricUrl} meta={meta} label="Open in Fabric" />
          </div>

          {/* Task Audit Section */}
          <section className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Task Audit Details</h3>
                <p className="text-[11px] text-slate-500">
                  {allTasks.length.toLocaleString()} total tasks recorded for this execution run
                </p>
              </div>

              {/* Status Filter Tabs & Copy All */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      statusFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All ({allTasks.length.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("SUCCESS")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      statusFilter === "SUCCESS"
                        ? "bg-emerald-950/80 text-emerald-300 shadow-sm"
                        : "text-slate-400 hover:text-emerald-300"
                    }`}
                  >
                    Success ({successCount.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("FAILED")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      statusFilter === "FAILED"
                        ? "bg-red-950/80 text-red-300 shadow-sm"
                        : "text-slate-400 hover:text-red-300"
                    }`}
                  >
                    Failed ({failedCount.toLocaleString()})
                  </button>
                </div>

                {failedCount > 0 && (
                  <button
                    type="button"
                    onClick={copyAllErrors}
                    className="flex items-center gap-1.5 rounded-lg border border-red-800/80 bg-red-950/50 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-900/70 hover:text-white transition shadow-sm"
                    title="Copy all failed task errors to clipboard"
                  >
                    {copiedAll ? (
                      <>
                        <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-emerald-400">Copied All {failedCount} Errors!</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy All {failedCount} Failed Errors</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Search and Page Size Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <svg
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by site code (e.g. AHK), database, or task name..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-slate-300"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Page Size & Summary */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={5000}>All ({totalItems.toLocaleString()})</option>
                </select>
              </div>
            </div>

            {/* Results count text & Top Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2 text-xs text-slate-400">
              <div className="text-[11px] text-slate-400">
                Showing <span className="font-semibold text-slate-200">{totalItems === 0 ? 0 : startIndex + 1}–{endIndex}</span> of{" "}
                <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> tasks
                {search ? ` (filtered from ${allTasks.length.toLocaleString()})` : ""}
              </div>

              {!isAll && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={currentPage <= 1}
                    title="First page"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Previous</span>
                  </button>

                  <span className="px-1 text-[11px] text-slate-400">
                    Page <span className="font-semibold text-slate-200">{currentPage}</span> of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    <span>Next</span>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Last page"
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              )}
            </div>

            {/* Tasks Table */}
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                <svg className="mr-2 h-4 w-4 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Loading task audit details…
              </div>
            )}

            {isError && (
              <p className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-xs text-red-300">
                Could not load task details.
              </p>
            )}

            {!isLoading && !isError && totalItems === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                {search
                  ? `No tasks match search query "${search}". Try clearing search or changing filters.`
                  : "No taskaudit or taskqueue records found for this run."}
              </div>
            )}

            {!isLoading && !isError && totalItems > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead className="bg-slate-900/90 text-left uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Task</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Site</th>
                        <th className="px-3 py-2 font-medium">Database</th>
                        <th className="px-3 py-2 text-right font-medium">Read</th>
                        <th className="px-3 py-2 text-right font-medium">Written</th>
                        <th className="px-3 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {pagedTasks.map((task, i) => {
                        const taskKey = task.TaskId || `${task.TaskName}-${task.SiteCode}-${i}`;
                        const isExpanded = expandedTaskId === taskKey;
                        const isFailed = task.Status === "FAILED";

                        return (
                          <Fragment key={`task-frag-${taskKey}`}>
                            <tr
                              onClick={() => task.ErrorMessage && setExpandedTaskId(isExpanded ? null : taskKey)}
                              className={`transition-colors ${
                                isFailed
                                  ? "bg-red-950/15 hover:bg-red-950/30"
                                  : "hover:bg-slate-900/60"
                              } ${task.ErrorMessage ? "cursor-pointer" : ""}`}
                            >
                              <td className="max-w-[260px] px-3 py-2">
                                <p className="truncate font-medium text-slate-200" title={task.TaskName}>
                                  {task.TaskName}
                                </p>
                                {task.TableName && (
                                  <p className="truncate text-[10px] text-slate-500 font-mono" title={task.TableName}>
                                    {task.TableName}
                                  </p>
                                )}
                                {task.ErrorMessage && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedTaskId(isExpanded ? null : taskKey);
                                      }}
                                      className="inline-flex items-center gap-1 rounded bg-red-950/70 border border-red-800/70 px-1.5 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-900/70 transition"
                                    >
                                      <span>{isExpanded ? "▼ Hide Error" : "▶ View Error"}</span>
                                    </button>
                                    <span className="truncate max-w-[170px] text-[10px] font-mono text-red-400/90" title={task.ErrorMessage}>
                                      {task.ErrorMessage}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <StatusBadge status={task.Status} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 font-mono font-medium text-sky-400">
                                {task.SiteCode || "—"}
                              </td>
                              <td className="max-w-[180px] truncate px-3 py-2 font-mono text-[11px] text-slate-300" title={task.DataBaseName}>
                                {task.DataBaseName ? (
                                  <span className="rounded bg-slate-900 px-1.5 py-0.5 border border-slate-800">
                                    {task.DataBaseName}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-300">
                                {formatNumber(task.RowsRead)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-300">
                                {formatNumber(task.RowsWritten)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                {task.ErrorMessage ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => copySingleError(task)}
                                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/90 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                                      title="Copy error message to clipboard"
                                    >
                                      {copiedTaskId === taskKey ? (
                                        <span className="text-emerald-400 font-semibold">Copied!</span>
                                      ) : (
                                        <>
                                          <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                          </svg>
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-[11px]">—</span>
                                )}
                              </td>
                            </tr>

                            {/* Full-width Expanded Error Row */}
                            {isExpanded && task.ErrorMessage && (
                              <tr key={`err-row-${taskKey}`} className="bg-red-950/25 border-b border-red-900/50">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="rounded-lg border border-red-900/60 bg-slate-950/95 p-3.5 shadow-lg">
                                    <div className="flex items-center justify-between gap-3 border-b border-red-900/40 pb-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-red-300">
                                          Error Details · {task.TaskName} {task.SiteCode ? `(Site: ${task.SiteCode})` : ""}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copySingleError(task)}
                                        className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
                                      >
                                        {copiedTaskId === taskKey ? (
                                          <>
                                            <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                              <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            <span className="text-emerald-400 font-medium">Copied to Clipboard!</span>
                                          </>
                                        ) : (
                                          <>
                                            <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            <span>Copy Error</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-red-200 bg-slate-900/80 p-2.5 rounded border border-slate-800">
                                      {task.ErrorMessage}
                                    </pre>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {!isAll && totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-400">
                    <div>
                      Page <span className="font-semibold text-slate-200">{currentPage}</span> of{" "}
                      <span className="font-semibold text-slate-200">{totalPages}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPage(1)}
                        disabled={currentPage <= 1}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="px-2 text-slate-500">
                        {startIndex + 1}–{endIndex}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage(totalPages)}
                        disabled={currentPage >= totalPages}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
