export interface TablePaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
  className?: string;
  compact?: boolean;
}

export function TablePaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, -1],
  label = "items",
  className = "",
  compact = false,
}: TablePaginationBarProps) {
  const isAll = pageSize === -1;
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);
  const from = totalItems === 0 ? 0 : isAll ? 1 : (safePage - 1) * pageSize + 1;
  const to = isAll ? totalItems : Math.min(safePage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-400 py-1 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Showing <span className="font-semibold text-slate-200">{from}–{to}</span> of{" "}
          <span className="font-semibold text-slate-200">{totalItems.toLocaleString()}</span> {label}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === -1 ? "All" : opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1 || isAll}
          onClick={() => onPageChange(1)}
          className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="First page"
        >
          «
        </button>
        <button
          type="button"
          disabled={safePage <= 1 || isAll}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹ Previous
        </button>
        <span className="px-2 font-medium text-slate-300 whitespace-nowrap">
          Page {safePage} of {safeTotalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= safeTotalPages || isAll}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next ›
        </button>
        <button
          type="button"
          disabled={safePage >= safeTotalPages || isAll}
          onClick={() => onPageChange(safeTotalPages)}
          className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
