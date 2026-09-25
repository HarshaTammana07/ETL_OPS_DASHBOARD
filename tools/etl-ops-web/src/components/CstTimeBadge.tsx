import { formatCstDateTime, formatCstShort, formatCstTime } from "../utils/formatDate";

interface CstTimeBadgeProps {
  time?: string | null;
  mode?: "full" | "short" | "timeOnly";
  className?: string;
  subtle?: boolean;
}

export function CstTimeBadge({
  time,
  mode = "full",
  className = "",
  subtle = false,
}: CstTimeBadgeProps) {
  if (!time) return <span className="text-slate-500">—</span>;

  let text = "";
  if (mode === "timeOnly") {
    text = formatCstTime(time);
  } else if (mode === "short") {
    text = formatCstShort(time);
  } else {
    text = formatCstDateTime(time);
  }

  if (subtle) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-300 ${className}`}>
        <svg className="h-3 w-3 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{text}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-sky-500/25 bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-200 shadow-sm ${className}`}
      title={`Raw UTC: ${time}`}
    >
      <svg className="h-3 w-3 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{text}</span>
    </span>
  );
}
