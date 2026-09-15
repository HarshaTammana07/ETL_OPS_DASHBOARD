import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { api } from "../api/client";
import { RunDetailsDrawer } from "./RunDetailsDrawer";
import { StatusBadge } from "./StatusBadge";

export interface RunMeta {
  RunId?: string;
  PipelineRunId?: string;
  ConfigId?: string;
  ConfigName?: string;
  PipelineName?: string;
  TargetName?: string;
  Status?: string;
  StartTime?: string;
  EndTime?: string;
  fabricUrl?: string | null;
}

interface FabricLinkProps {
  url?: string | null;
  meta?: RunMeta;
  label?: string;
  className?: string;
}

const META_FIELDS: { key: keyof RunMeta; label: string }[] = [
  { key: "PipelineRunId", label: "Pipeline run ID" },
  { key: "RunId", label: "Run ID" },
  { key: "ConfigName", label: "Pipeline" },
  { key: "PipelineName", label: "Fabric name" },
  { key: "TargetName", label: "Layer" },
  { key: "Status", label: "Status" },
  { key: "StartTime", label: "Start" },
  { key: "EndTime", label: "End" },
  { key: "ConfigId", label: "Config ID" },
];

const POPOVER_WIDTH = 360;
const POPOVER_GAP = 10;
const ESTIMATED_HEIGHT = 420;

function computePopoverPosition(anchor: DOMRect, popoverHeight = ESTIMATED_HEIGHT) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const margin = 12;

  let left = anchor.right + POPOVER_GAP;
  let placement: "right" | "left" = "right";

  if (left + POPOVER_WIDTH > viewportW - margin) {
    left = anchor.left - POPOVER_WIDTH - POPOVER_GAP;
    placement = "left";
  }
  left = Math.max(margin, Math.min(left, viewportW - POPOVER_WIDTH - margin));

  let top = anchor.top;
  if (top + popoverHeight > viewportH - margin) {
    top = viewportH - popoverHeight - margin;
  }
  top = Math.max(margin, top);

  return { top, left, placement };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard blocked */
      }
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-400 hover:bg-slate-700 hover:text-sky-300"
      title={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ExpandIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
    </svg>
  );
}

function RunMetaPopover({
  meta,
  url,
  onExpand,
}: {
  meta: RunMeta;
  url?: string | null;
  onExpand?: () => void;
}) {
  const [tasks, setTasks] = useState<
    {
      TaskName: string;
      Status: string;
      SiteCode?: string;
      DataBaseName?: string;
      RowsRead?: string;
      RowsWritten?: string;
      ErrorMessage?: string;
    }[]
  >([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!meta.RunId && !meta.PipelineRunId) return;
    let cancelled = false;
    setLoadingTasks(true);
    const fetcher = meta.RunId
      ? api.runTasks(meta.RunId, {
          pipelineRunId: meta.PipelineRunId,
          configId: meta.ConfigId,
        })
      : api.runTasks(meta.PipelineRunId!, { pipelineRunId: meta.PipelineRunId, configId: meta.ConfigId });
    fetcher
      .then((res) => {
        if (!cancelled) setTasks(res.tasks ?? []);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.RunId, meta.PipelineRunId, meta.ConfigId]);

  const entries = META_FIELDS.map(({ key, label }) => ({
    label,
    value: meta[key]?.toString().trim(),
  })).filter((e) => e.value);

  if (url) {
    entries.push({ label: "Fabric URL", value: url });
  }

  const failedTasks = tasks.filter((t) => t.Status === "FAILED" && (t.ErrorMessage || t.TaskName));
  const successSample = tasks.filter((t) => t.Status === "SUCCESS").slice(0, 3);

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Run details</p>
          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onExpand();
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-sky-500/15 hover:text-sky-200"
              title="Expand to full run card"
              aria-label="Expand run details"
            >
              <ExpandIcon />
              Expand
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No run metadata available</p>
        ) : (
          <dl className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
            {entries.map(({ label, value }) => (
              <div key={label} className="rounded-md bg-slate-950/80 p-2">
                <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
                <dd className="mt-0.5 flex items-start justify-between gap-2">
                  <code className="break-all text-[11px] leading-snug text-slate-200">{value}</code>
                  <CopyButton value={value!} label={label} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {(meta.RunId || meta.PipelineRunId) && (
        <div className="border-t border-slate-700 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Task audit {meta.Status === "FAILED" ? "(errors)" : "(sample)"}
          </p>
          {loadingTasks && <p className="mt-1 text-[11px] text-slate-500">Loading taskaudit…</p>}
          {!loadingTasks && failedTasks.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {failedTasks.slice(0, 8).map((task, i) => (
                <li key={i} className="rounded-md border border-red-900/40 bg-red-950/30 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-100">{task.TaskName}</span>
                    <StatusBadge status={task.Status} />
                    {task.SiteCode && <span className="text-[10px] text-sky-300">{task.SiteCode}</span>}
                  </div>
                  {(task.DataBaseName || task.RowsRead || task.RowsWritten) && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {task.DataBaseName && <span>{task.DataBaseName} · </span>}
                      rows {task.RowsRead || "0"}→{task.RowsWritten || "0"}
                    </p>
                  )}
                  {task.ErrorMessage && (
                    <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-red-200/90">
                      {task.ErrorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!loadingTasks && failedTasks.length === 0 && successSample.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {successSample.map((task, i) => (
                <li key={i} className="rounded-md bg-slate-950/80 p-2 text-[11px] text-slate-300">
                  <span className="font-medium text-slate-100">{task.TaskName}</span>
                  {task.SiteCode && <span className="text-sky-300"> · {task.SiteCode}</span>}
                  <span className="text-slate-500">
                    {" "}
                    · rows {task.RowsRead || "0"}→{task.RowsWritten || "0"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!loadingTasks && tasks.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-500">No taskaudit rows for this run.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RunLinkWithPopover({
  url,
  meta,
  label,
  className,
  variant,
}: FabricLinkProps & { variant: "link" | "info" }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: "right" as "right" | "left" });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expandToDrawer = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPinned(false);
    setOpen(false);
    setExpanded(true);
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor) return;
    const height = popover?.offsetHeight ?? ESTIMATED_HEIGHT;
    setPosition(computePopoverPosition(anchor.getBoundingClientRect(), height));
  }, []);

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    if (pinned) return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [pinned]);

  const togglePin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pinned) {
        setPinned(false);
        setOpen(false);
      } else {
        setPinned(true);
        setOpen(true);
      }
    },
    [pinned],
  );

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !pinned) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setPinned(false);
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, pinned]);

  const activeStyles = open || pinned;

  const triggerClass = clsx(
    "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
    activeStyles
      ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/60"
      : variant === "link"
        ? "text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
    className,
  );

  const trigger =
    variant === "link" && url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={triggerClass}
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {label}
      </a>
    ) : (
      <button type="button" onClick={(e) => e.stopPropagation()} className={triggerClass}>
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Details
      </button>
    );

  return (
    <>
      <span
        ref={anchorRef}
        className={clsx(
          "inline-flex items-center gap-0.5 rounded-md transition-shadow",
          activeStyles && "ring-1 ring-sky-500/30",
        )}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {trigger}
        <button
          type="button"
          onClick={togglePin}
          className={clsx(
            "rounded p-1 transition-colors",
            pinned || open
              ? "bg-sky-500/25 text-sky-200"
              : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
          )}
          title={pinned ? "Close details" : "Pin details panel"}
          aria-label="Toggle run details"
        >
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </span>

      {open &&
        meta &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] w-[360px] rounded-xl border border-sky-500/40 bg-slate-900 p-3 shadow-2xl shadow-black/50"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={show}
            onMouseLeave={hide}
            role="dialog"
            aria-label="Run details"
          >
            <RunMetaPopover meta={meta} url={url} onExpand={expandToDrawer} />
            <p className="mt-2 border-t border-slate-700 pt-2 text-[10px] text-slate-500">
              {pinned
                ? "Pinned — click outside or ⋮ to close"
                : `Panel opens to the ${position.placement} · Expand ⛶ for full card · Pin ⋮ to keep open`}
            </p>
          </div>,
          document.body,
        )}

      <RunDetailsDrawer meta={expanded && meta ? meta : null} onClose={() => setExpanded(false)} />
    </>
  );
}

export function FabricLink({ url, meta, label = "Open in Fabric", className = "" }: FabricLinkProps) {
  const hasMeta = meta && (meta.PipelineRunId || meta.RunId || meta.ConfigName);

  if (!url && !hasMeta) {
    return <span className="text-slate-600">—</span>;
  }

  if (!url && hasMeta) {
    return <RunLinkWithPopover meta={meta!} variant="info" className={className} />;
  }

  return (
    <RunLinkWithPopover url={url} meta={meta ?? { fabricUrl: url }} label={label} className={className} variant="link" />
  );
}

export function fabricLinkColumn() {
  return {
    key: "fabricUrl",
    label: "Fabric",
    render: (_: string, row: Record<string, string>) => (
      <FabricLink url={row.fabricUrl} meta={row as RunMeta} label="View run" />
    ),
  };
}

export function rowToRunMeta(row: Record<string, string>): RunMeta {
  return {
    RunId: row.RunId,
    PipelineRunId: row.PipelineRunId,
    ConfigId: row.ConfigId,
    ConfigName: row.ConfigName,
    PipelineName: row.PipelineName,
    TargetName: row.TargetName,
    Status: row.Status,
    StartTime: row.StartTime,
    EndTime: row.EndTime,
    fabricUrl: row.fabricUrl,
  };
}
