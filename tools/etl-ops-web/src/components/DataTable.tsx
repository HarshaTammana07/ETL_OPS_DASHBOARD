interface DataTableProps {
  columns: { key: string; label: string; render?: (value: string, row: Record<string, string>) => React.ReactNode }[];
  rows: Record<string, string>[];
  emptyMessage?: string;
  onRowClick?: (row: Record<string, string>) => void;
}

export function DataTable({ columns, rows, emptyMessage = "No data", onRowClick }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={onRowClick ? "cursor-pointer hover:bg-slate-800/50" : "hover:bg-slate-900/50"}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 text-slate-200 ${col.key === "fabricUrl" ? "overflow-visible whitespace-nowrap" : "max-w-xs truncate"}`}
                >
                  {col.render ? col.render(row[col.key] ?? "", row) : (row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
