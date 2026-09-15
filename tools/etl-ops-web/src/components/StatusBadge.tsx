import clsx from "clsx";

const styles: Record<string, string> = {
  SUCCESS: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  FAILED: "bg-red-500/20 text-red-300 ring-red-500/40",
  RUNNING: "bg-blue-500/20 text-blue-300 ring-blue-500/40",
  SKIPPED: "bg-slate-500/20 text-slate-300 ring-slate-500/40",
};

const layerStyles: Record<string, string> = {
  BR: "bg-amber-500/20 text-amber-200",
  SL: "bg-slate-400/20 text-slate-200",
  GL: "bg-yellow-500/20 text-yellow-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", styles[status] ?? styles.SKIPPED)}>
      {status}
    </span>
  );
}

export function LayerBadge({ layer }: { layer: string }) {
  return (
    <span className={clsx("inline-flex rounded px-1.5 py-0.5 text-xs font-semibold", layerStyles[layer] ?? "bg-slate-700 text-slate-200")}>
      {layer}
    </span>
  );
}
