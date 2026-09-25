import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";

function timeAgo(isoString?: string | null): string {
  if (!isoString) return "Not synced yet";
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}

export function FabricSyncBadge() {
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  // Poll sync status every 6 seconds
  const { data: status, isError } = useQuery({
    queryKey: ["fabricSyncStatus"],
    queryFn: api.syncStatus,
    refetchInterval: 6_000,
    retry: 1,
  });

  // Re-render relative time every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(timer);
  }, []);

  // When a sync completes (lastSyncTime changes), invalidate all queries to refresh UI
  useEffect(() => {
    if (status?.lastSyncTime) {
      queryClient.invalidateQueries();
    }
  }, [status?.lastSyncTime, queryClient]);

  const syncMutation = useMutation({
    mutationFn: () => api.triggerSync({ lookbackDays: 7 }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  if (isError || status?.enabled === false) {
    return null;
  }

  const isSyncing = status?.isSyncing || syncMutation.isPending;
  const relativeTime = timeAgo(status?.lastSyncTime);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs shadow-inner">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {isSyncing ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          ) : (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isSyncing ? "bg-amber-400" : "bg-emerald-500"
            }`}
          />
        </span>
        <span className="font-medium text-slate-200">Fabric Live</span>
      </div>

      <span className="hidden text-[11px] text-slate-400 sm:inline">
        {isSyncing ? "Syncing..." : relativeTime}
      </span>

      <button
        type="button"
        onClick={() => syncMutation.mutate()}
        disabled={isSyncing}
        title={
          status?.lastStats
            ? `Last sync: ${status.lastDurationSec}s | Runs: ${status.lastStats.pipelinerun ?? 0}, Tasks: ${status.lastStats.taskqueue ?? 0}`
            : "Trigger instant sync with Microsoft Fabric"
        }
        className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
      >
        <svg
          className={`h-3 w-3 ${isSyncing ? "animate-spin text-amber-400" : "text-slate-400"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>{isSyncing ? "Syncing" : "Sync"}</span>
      </button>
    </div>
  );
}
