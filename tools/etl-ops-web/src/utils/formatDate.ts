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

/** Formats duration between start and end times into a human-readable string (e.g. "45s", "2m 15s", "1h 05m") */
export function formatDuration(start?: string | Date | null, end?: string | Date | null): string {
  if (!start) return "—";
  const startDate = start instanceof Date ? start : parseUtcDate(start);
  if (!startDate) return "—";

  const endDate = end ? (end instanceof Date ? end : parseUtcDate(end)) : null;
  if (!endDate) return "—";

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return "0s";

  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) {
    return `${totalSec}s`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/** For currently running jobs (where end time is null), computes elapsed time since start */
export function formatElapsedDuration(start?: string | Date | null): string {
  if (!start) return "—";
  const startDate = start instanceof Date ? start : parseUtcDate(start);
  if (!startDate) return "—";

  const diffMs = Date.now() - startDate.getTime();
  if (diffMs < 0) return "0s";

  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) {
    return `${totalSec}s`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}


