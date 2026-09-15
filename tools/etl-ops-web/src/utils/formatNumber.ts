const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCompactNumber(value?: string | number | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return compactFormatter.format(n);
}

export function formatFullNumber(value?: string | number | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

/** Compact display with full value as tooltip when abbreviated. */
export function formatCountDisplay(value?: string | number | null): { text: string; title?: string } {
  const full = formatFullNumber(value);
  const compact = formatCompactNumber(value);
  return compact !== full ? { text: compact, title: full } : { text: full };
}
