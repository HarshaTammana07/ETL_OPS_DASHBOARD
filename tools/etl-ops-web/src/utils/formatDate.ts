/**
 * Central Time (CST/CDT) date and time formatting utilities.
 * Automatically treats Fabric Lakehouse UTC timestamps as UTC and converts to America/Chicago.
 */

export function parseUtcDate(value?: string | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`);
  }

  // Handle ISO with or without space
  let iso = s.replace(" ", "T");

  // If no timezone offset is specified, append Z (Fabric stores in UTC)
  if (!iso.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(iso)) {
    iso = `${iso}Z`;
  }

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formats as "Sep 24, 2026 · 09:58 AM CST" */
export function formatCstDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = parseUtcDate(value);
  if (!d) return value.slice(0, 16);

  const datePart = d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const timePart = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} · ${timePart} CST`;
}

/** Formats as "Sep 24, 09:58 AM CST" (compact for tables) */
export function formatCstShort(value?: string | null): string {
  if (!value) return "—";
  const d = parseUtcDate(value);
  if (!d) return value.slice(0, 16);

  const datePart = d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  });

  const timePart = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart}, ${timePart} CST`;
}

/** Formats as "09:58 AM CST" */
export function formatCstTime(value?: string | null): string {
  if (!value) return "—";
  const d = parseUtcDate(value);
  if (!d) return value.slice(11, 16);

  const timePart = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${timePart} CST`;
}

/** Formats as "Sep 24, 2026" (date only) */
export function formatCstDate(value?: string | null): string {
  if (!value) return "—";
  const d = parseUtcDate(value);
  if (!d) return value.slice(0, 10);

  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

