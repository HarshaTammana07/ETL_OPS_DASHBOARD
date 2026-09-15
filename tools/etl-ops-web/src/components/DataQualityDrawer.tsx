import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FabricLink, rowToRunMeta } from "./FabricLink";
import { LayerBadge, StatusBadge } from "./StatusBadge";
import { buildTrendsHref } from "./TrendsScopeBar";
import { formatFullNumber } from "../utils/formatNumber";

export interface DqIssueRow {
  DqId?: string;
  CreatedAt?: string;
  TableName?: string;
  RowCount?: string | number;
  NullCount?: string | number;
  DuplicateCount?: string | number;
  ValidationStatus?: string;
  PipelineRunId?: string;
  RunId?: string;
  ConfigId?: string;
  ConfigName?: string;
  TargetName?: string;
  PipelineName?: string;
  fabricUrl?: string | null;
}

function formatShortTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19).replace("T", " ");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SlideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
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

export function DataQualityDrawer({ issue, onClose }: { issue: DqIssueRow | null; onClose: () => void }) {
  const open = !!issue;

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title={issue?.TableName ?? "Data quality issue"}
      subtitle="Validation failure"
    >
      {issue && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.ValidationStatus ?? "FAILED"} />
            {issue.TargetName && <LayerBadge layer={issue.TargetName} />}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["Created", formatShortTime(issue.CreatedAt)],
              ["Rows", formatFullNumber(issue.RowCount)],
              ["Nulls", formatFullNumber(issue.NullCount)],
              ["Duplicates", formatFullNumber(issue.DuplicateCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-100">{value}</p>
              </div>
            ))}
          </div>

          {issue.ConfigName && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Pipeline</p>
              <p className="mt-0.5 text-sm text-sky-300">{issue.ConfigName}</p>
              {issue.PipelineName && <p className="text-xs text-slate-500">{issue.PipelineName}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {issue.ConfigName && (
              <Link
                to={buildTrendsHref({
                  configName: issue.ConfigName,
                  targetName: issue.TargetName as "BR" | "SL" | "GL" | undefined,
                })}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sky-400 hover:bg-slate-800"
              >
                Trends
              </Link>
            )}
            {issue.PipelineRunId && (
              <Link
                to={`/runs?pipelineRunId=${encodeURIComponent(issue.PipelineRunId)}`}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sky-400 hover:bg-slate-800"
              >
                Run Explorer
              </Link>
            )}
            <FabricLink
              url={issue.fabricUrl}
              meta={rowToRunMeta(issue as unknown as Record<string, string>)}
              label="Fabric"
            />
          </div>

          {issue.PipelineRunId && (
            <p className="font-mono text-[11px] text-slate-500">
              Parent run: <span className="text-slate-400">{issue.PipelineRunId}</span>
            </p>
          )}
        </div>
      )}
    </SlideDrawer>
  );
}
