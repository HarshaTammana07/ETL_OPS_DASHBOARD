import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../api/client";
import type { GlobalFilters } from "../types";

/** Merge URL filters with health API defaults so API calls always include an effective date range. */
export function useEffectiveFilters(raw: GlobalFilters): GlobalFilters {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: api.health });

  return useMemo(() => {
    const defaultTo = health?.defaultRefDate;
    const startDateTo = raw.startDateTo ?? raw.refDate ?? defaultTo;
    const startDateFrom = raw.startDateFrom ?? startDateTo;

    return {
      ...raw,
      startDateFrom: startDateFrom || undefined,
      startDateTo: startDateTo || undefined,
    };
  }, [raw, health?.defaultRefDate]);
}
