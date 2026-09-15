interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Hide the full "Showing X–Y of Z" text (useful in tight toolbars). */
  compact?: boolean;
}

function pageWindow(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (const p of sorted) {
    if (out.length && typeof out[out.length - 1] === "number" && p - (out[out.length - 1] as number) > 1) {
      out.push("…");
    }
    out.push(p);
  }
  return out;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
  compact = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  if (total === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-slate-400 ${className}`}>
      {!compact && (
        <p className="mr-1">
          Showing <span className="tabular-nums text-slate-200">{from}</span>–
          <span className="tabular-nums text-slate-200">{to}</span> of{" "}
          <span className="tabular-nums text-slate-200">{total}</span>
        </p>
      )}
      {compact && (
        <p className="tabular-nums text-slate-400">
          <span className="text-slate-200">{from}</span>–<span className="text-slate-200">{to}</span>
          <span className="text-slate-600"> / </span>
          <span className="text-slate-200">{total}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        {pageWindow(safePage, totalPages).map((item, i) =>
          item === "…" ? (
            <span key={`e-${i}`} className="px-1 text-slate-600">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={
                item === safePage
                  ? "min-w-[1.75rem] rounded-md bg-sky-600 px-2 py-1 font-medium text-white"
                  : "min-w-[1.75rem] rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
              }
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
