import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { FabricLink, rowToRunMeta } from "./FabricLink";
import { LayerBadge, StatusBadge } from "./StatusBadge";
import { buildTrendsHref } from "./TrendsScopeBar";
import type { GlobalFilters } from "../types";

export interface PipelineCatalogRow {
  ConfigName: string;
  TargetName?: string;
  SourceSystem?: string;
  IsActive?: string;
  runs_in_window?: string | number;
  failed_runs?: string | number;
  last_run?: string;
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
  ariaLabel,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  ariaLabel: string;
  wide?: boolean;
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
    <div className="fixed inset-0 z-[10000] flex justify-end" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <aside
        className={`relative flex h-full w-full ${wide ? "max-w-3xl" : "max-w-2xl"} flex-col border-l border-slate-700 bg-slate-950 shadow-2xl`}
      >
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

function ActiveBadge({ value }: { value?: string }) {
  const on = value === "1" || value?.toLowerCase() === "true";
  return (
    <span
      className={
        on
          ? "rounded-full bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-300"
          : "rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-500"
      }
    >
      {on ? "Active" : "Inactive"}
    </span>
  );
}

interface PipelineConfigDrawerProps {
  config: PipelineCatalogRow | null;
  filters: GlobalFilters;
  onClose: () => void;
  onSelectRun: (pipelineRunId: string) => void;
}

export function PipelineConfigDrawer({ config, filters, onClose, onSelectRun }: PipelineConfigDrawerProps) {
  const open = !!config;

  const { data: runsData, isLoading } = useQuery({
    queryKey: ["pipelineRuns", "drawer", config?.ConfigName, filters],
    queryFn: () =>
      api.pipelineRuns({
        ...filters,
        configName: config!.ConfigName,
        limit: 50,
      }),
    enabled: open,
  });

  const runs = runsData?.runs ?? [];

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title={config?.ConfigName ?? ""}
      subtitle="Pipeline module"
      ariaLabel="Pipeline details"
      wide
    >
      {config && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {config.TargetName && <LayerBadge layer={config.TargetName} />}
            <ActiveBadge value={config.IsActive} />
            {config.SourceSystem && (
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{config.SourceSystem}</span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Runs in window", config.runs_in_window ?? "0"],
              ["Failed", config.failed_runs ?? "0"],
              ["Last run", formatShortTime(config.last_run)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={buildTrendsHref({
                configName: config.ConfigName,
                targetName: config.TargetName as "BR" | "SL" | "GL" | undefined,
              })}
              className="rounded-lg bg-sky-900/50 px-3 py-1.5 text-xs text-sky-200 ring-1 ring-sky-700/50 hover:bg-sky-900"
              onClick={onClose}
            >
              View in Trends
            </Link>
            <Link
              to={`/runs?q=${encodeURIComponent(config.ConfigName)}`}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-sky-300 hover:bg-slate-700"
              onClick={onClose}
            >
              Run Explorer
            </Link>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent executions</h3>
            {isLoading ? (
              <p className="text-sm text-slate-400">Loading runs…</p>
            ) : runs.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
                No runs for this pipeline in the selected date window.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Layer</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Start</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {runs.map((run) => (
                      <tr key={`${run.PipelineRunId}-${run.RunId}`} className="hover:bg-slate-800/50">
                        <td className="px-3 py-1.5">
                          <LayerBadge layer={run.TargetName} />
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusBadge status={run.Status} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{formatShortTime(run.StartTime)}</td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectRun(run.PipelineRunId)}
                            className="text-sky-400 hover:underline"
                          >
                            Layers
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </SlideDrawer>
  );
}

interface PipelineRunLayersDrawerProps {
  pipelineRunId: string | null;
  onClose: () => void;
}

export function PipelineRunLayersDrawer({ pipelineRunId, onClose }: PipelineRunLayersDrawerProps) {
  const open = !!pipelineRunId;

  const { data: layers, isLoading } = useQuery({
    queryKey: ["pipelineLayers", pipelineRunId],
    queryFn: () => api.pipelineLayers(pipelineRunId!),
    enabled: open,
  });

  const layerRows = layers?.layers ?? [];

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title={layerRows[0]?.ConfigName || "Layer breakdown"}
      subtitle="Parent run · BR / SL / GL"
      ariaLabel="Pipeline run layers"
      wide
    >
      {pipelineRunId && (
        <div className="space-y-4">
          <p className="break-all font-mono text-[11px] text-slate-500">{pipelineRunId}</p>

          <div className="flex flex-wrap gap-2">
            <Link
              to={buildTrendsHref({ pipelineRunId })}
              className="rounded-lg bg-sky-900/50 px-3 py-1.5 text-xs text-sky-200 ring-1 ring-sky-700/50 hover:bg-sky-900"
              onClick={onClose}
            >
              View trends
            </Link>
            <Link
              to={`/runs?pipelineRunId=${encodeURIComponent(pipelineRunId)}`}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-sky-300 hover:bg-slate-700"
              onClick={onClose}
            >
              Run Explorer
            </Link>
            <FabricLink
              url={layerRows[0]?.fabricUrl}
              meta={layerRows[0] ? rowToRunMeta(layerRows[0]) : undefined}
              label="Open in Fabric"
              className="text-sm"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading layers…</p>
          ) : layerRows.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-4 text-sm text-slate-400">
              No layers found for this parent run.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Layer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Start</th>
                    <th className="px-3 py-2 font-medium">End</th>
                    <th className="px-3 py-2 font-medium text-right">Failed</th>
                    <th className="px-3 py-2 font-medium">Fabric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {layerRows.map((row) => (
                    <tr key={row.RunId || `${row.TargetName}-${row.StartTime}`} className="hover:bg-slate-800/50">
                      <td className="px-3 py-1.5">
                        <LayerBadge layer={row.TargetName} />
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={row.Status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{formatShortTime(row.StartTime)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{formatShortTime(row.EndTime)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-red-300">{row.FailedTasks ?? "0"}</td>
                      <td className="px-3 py-1.5">
                        <FabricLink url={row.fabricUrl} meta={rowToRunMeta(row)} label="Open" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SlideDrawer>
  );
}
