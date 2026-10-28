import { formatDuration, formatElapsedDuration } from "../utils/formatDate";

interface DurationBadgeProps {
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  status?: string;
  className?: string;
  prefix?: string;
}

export function DurationBadge({
  startTime,
  endTime,
  status,
  className = "",
  prefix,
}: DurationBadgeProps) {
  const isRunning = status === "RUNNING" || (!endTime && status !== "FAILED" && status !== "SUCCESS");

  let text = "—";
  let title = "Duration";

  if (isRunning) {
    const elapsed = formatElapsedDuration(startTime);
    text = elapsed === "—" ? "running" : `${elapsed} running`;
    title = `In progress: ${elapsed} elapsed since start`;
  } else if (startTime && endTime) {
    const dur = formatDuration(startTime, endTime);
    text = dur;
    title = `Total execution time: ${dur}`;
  } else if (startTime) {
    const elapsed = formatElapsedDuration(startTime);
    text = elapsed;
    title = `Execution duration: ${elapsed}`;
  }

  if (text === "—") return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium border transition-colors ${
        isRunning
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300 animate-pulse"
          : status === "FAILED"
            ? "border-red-900/40 bg-red-950/20 text-red-300"
            : "border-slate-700/80 bg-slate-900/80 text-emerald-300/90"
      } ${className}`}
      title={title}
    >
      <svg className="h-3 w-3 shrink-0 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>
        {prefix ? `${prefix}: ` : ""}
        {text}
      </span>
    </span>
  );
}
