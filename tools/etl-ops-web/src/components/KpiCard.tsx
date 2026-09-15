import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
  active?: boolean;
  onClick?: () => void;
}

const tones = {
  default: "border-slate-700 bg-slate-900/80",
  success: "border-emerald-700/50 bg-emerald-950/40",
  warning: "border-amber-700/50 bg-amber-950/40",
  danger: "border-red-700/50 bg-red-950/40",
};

const activeRing = {
  default: "ring-2 ring-slate-400 ring-offset-2 ring-offset-slate-950",
  success: "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950",
  warning: "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950",
  danger: "ring-2 ring-red-400 ring-offset-2 ring-offset-slate-950",
};

export function KpiCard({ label, value, hint, tone = "default", active = false, onClick }: KpiCardProps) {
  const className = clsx(
    "rounded-xl border p-4 shadow-sm text-left transition",
    tones[tone],
    active && activeRing[tone],
    onClick && "cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-pressed={active}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
