import type {
  ChatRequestBody,
  ChatResponse,
  DailyKpis,
  FailedTask,
  GlobalFilters,
  NotificationAlert,
  NotificationSummary,
  PipelineRun,
  ReliabilityTrends,
  TaskActivityTrends,
  TrendPoint,
} from "../types";

const BASE = "/api";

export const FALLBACK_CHAT_PROMPTS = [
  "What failed today?",
  "Failures this week",
  "Which pipelines are still running?",
  "Did site AHK run successfully?",
  "Show today's KPI summary",
  "Help",
];

async function fetchWithTimeout(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`API timed out after ${timeoutMs / 1000}s — is the backend running on port 8000?`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string, timeoutMs = 20_000): Promise<T> {
  const res = await fetchWithTimeout(path, {}, timeoutMs);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const res = await fetchWithTimeout(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

function toParams(filters: Partial<GlobalFilters> & Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      params.set(snake, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  health: () =>
    get<{ status: string; dataBounds: { minDate: string | null; maxDate: string | null }; defaultRefDate: string }>(
      "/health",
    ),
  dailyKpis: (filters: Partial<GlobalFilters>) => get<DailyKpis>(`/kpis/daily${toParams(filters)}`),
  recentRuns: (filters: Partial<GlobalFilters> & { limit?: number; offset?: number; q?: string }) =>
    get<{ runs: PipelineRun[]; total: number; limit: number; offset: number }>(
      `/kpis/recent-runs${toParams(filters)}`,
    ),
  runningTasks: () => get<{ tasks: Record<string, string>[] }>("/kpis/running"),
  dailyTrends: (filters: Partial<GlobalFilters>) =>
    get<{ points: TrendPoint[] }>(`/trends/daily${toParams(filters)}`),
  reliabilityTrends: (filters: Partial<GlobalFilters> & { topLimit?: number }) =>
    get<ReliabilityTrends>(`/trends/reliability${toParams(filters)}`),
  taskActivityTrends: (filters: Partial<GlobalFilters> & { topLimit?: number }) =>
    get<TaskActivityTrends>(`/trends/task-activity${toParams(filters)}`),
  topFailures: (filters: Partial<GlobalFilters> & { limit?: number }) =>
    get<{ items: { ConfigName: string; failure_count: number }[] }>(`/trends/top-failures${toParams(filters)}`),
  pipelinesOverview: (filters: Partial<GlobalFilters>) =>
    get<{ pipelines: Record<string, string>[] }>(`/pipelines/overview${toParams(filters)}`),
  pipelineRuns: (filters: Partial<GlobalFilters>) =>
    get<{ runs: PipelineRun[] }>(`/pipelines/runs${toParams(filters)}`),
  pipelineLayers: (pipelineRunId: string) =>
    get<{ layers: Record<string, string>[] }>(`/pipelines/${encodeURIComponent(pipelineRunId)}/layers`),
  runTasks: (runId: string, opts?: { pipelineRunId?: string; configId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.pipelineRunId) params.set("pipeline_run_id", opts.pipelineRunId);
    if (opts?.configId) params.set("config_id", opts.configId);
    const qs = params.toString();
    return get<{
      tasks: {
        TaskId: string;
        TaskName: string;
        TableName?: string;
        Status: string;
        SiteCode?: string;
        DataBaseName?: string;
        RowsRead?: string;
        RowsWritten?: string;
        RowsFailed?: string;
        ErrorMessage?: string;
        StartTime?: string;
      }[];
    }>(`/pipelines/runs/${encodeURIComponent(runId)}/tasks${qs ? `?${qs}` : ""}`);
  },
  failedTasks: (filters: Partial<GlobalFilters> & { limit?: number; offset?: number; noSiteOnly?: boolean }) =>
    get<{ failures: FailedTask[]; total: number; limit: number; offset: number }>(
      `/failures/tasks${toParams(filters)}`,
    ),
  failureOverview: (filters: Partial<GlobalFilters>) =>
    get<{
      totalFailures: number;
      bronzeFailures: number;
      silverFailures: number;
      goldFailures: number;
      pipelineCount: number;
      siteCount: number;
      noSiteFailures: number;
    }>(`/failures/overview${toParams(filters)}`),
  siteFailureSummary: (filters: Partial<GlobalFilters> & { limit?: number }) =>
    get<{
      sites: {
        SiteCode: string;
        DataBaseName: string;
        SiteName: string;
        failure_count: number;
        pipeline_count: number;
        last_failure: string;
        sample_pipeline: string;
      }[];
    }>(`/failures/sites/summary${toParams(filters)}`),
  siteAudit: (siteCode: string, filters: Partial<GlobalFilters> & { limit?: number }) =>
    get<{ audits: Record<string, string>[] }>(
      `/failures/sites/${encodeURIComponent(siteCode)}/audit${toParams(filters)}`,
    ),
  dqOverview: (filters: Partial<GlobalFilters>) =>
    get<{
      totalIssues: number;
      failedCount: number;
      zeroRowsCount: number;
      tableCount: number;
      pipelineCount: number;
      nullIssues: number;
      duplicateIssues: number;
    }>(`/data-quality/overview${toParams(filters)}`),
  dqIssues: (filters: Partial<GlobalFilters> & { limit?: number; offset?: number }) =>
    get<{ issues: Record<string, string>[]; total: number }>(`/data-quality/issues${toParams(filters)}`),
  searchRuns: (params: { runId?: string; pipelineRunId?: string; siteCode?: string; refDate?: string }) =>
    get<{ results: Record<string, string>[] }>(`/runs/search${toParams(params)}`),
  notifications: (filters: Partial<GlobalFilters> & { limit?: number; offset?: number }) =>
    get<{ items: NotificationAlert[]; total: number; limit: number; offset: number }>(
      `/notifications${toParams(filters)}`,
    ),
  notificationSummary: (filters: Partial<GlobalFilters>) =>
    get<NotificationSummary>(`/notifications/summary${toParams(filters)}`),
  backfillNotifications: (filters: Partial<GlobalFilters> & { limit?: number }) =>
    post<{ inserted: number; skipped: number; scanned: number }>(
      `/notifications/backfill${toParams(filters)}`,
      {},
    ),
  configNames: (q?: string) => get<{ items: string[] }>(`/meta/config-names${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  sourceSystems: () => get<{ items: string[] }>("/meta/source-systems"),
  chatPrompts: () => get<{ prompts: string[] }>("/chat/prompts"),
  chatConfig: () => get<{ mode: "agent" | "rules"; provider: string | null; model: string | null }>("/chat/config"),
  chat: (body: ChatRequestBody) => post<ChatResponse>("/chat", body, 90_000),
};
