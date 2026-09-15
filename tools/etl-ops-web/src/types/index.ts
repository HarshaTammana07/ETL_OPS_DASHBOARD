export type TargetName = "BR" | "SL" | "GL";

export interface GlobalFilters {
  /** @deprecated use startDateFrom/startDateTo */
  refDate?: string;
  /** @deprecated use startDateFrom/startDateTo */
  lookbackDays?: number;
  startDateFrom?: string;
  startDateTo?: string;
  configName?: string;
  targetName?: TargetName;
  siteCode?: string;
  sourceSystem?: string;
  method?: string;
  status?: string;
  pipelineRunId?: string;
  runId?: string;
}

export interface DailyKpis {
  startDateFrom: string;
  startDateTo: string;
  refDate: string;
  totalRuns: number;
  successPct: number;
  failedRuns: number;
  failedPct: number;
  runningRuns: number;
  runningPct: number;
  failedSiteCount: number;
}

export interface PipelineRun {
  RunId: string;
  PipelineRunId: string;
  ConfigName: string;
  TargetName: string;
  SourceSystem?: string;
  Status: string;
  StartTime: string;
  EndTime: string;
  SuccessTasks?: string;
  FailedTasks?: string;
  TotalTasks?: string;
  ConfigId?: string;
  PipelineName?: string;
  fabricUrl?: string | null;
}

export interface TrendPoint {
  runDate: string;
  successRuns: number;
  failedRuns: number;
  runningRuns?: number;
  totalRuns?: number;
  successPct: number;
  avgDurationSec?: number | null;
}

export interface RunScopeContext {
  pipelineRunId?: string;
  runId?: string | null;
  scopedRunId?: string | null;
  layerCount: number;
  configNames: string[];
  startTime?: string | null;
  endTime?: string | null;
  layers: PipelineRun[];
}

export interface ReliabilityTrends {
  runScope?: RunScopeContext | null;
  summary: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    runningRuns: number;
    successPct: number;
    failedPct: number;
    avgDurationSec: number | null;
    retriedRuns: number;
  };
  daily: TrendPoint[];
  durationByLayer: { layer: string; avgDurationSec: number; runCount: number }[];
  durationDaily: { runDate: string; BR: number | null; SL: number | null; GL: number | null; OTHER: number | null }[];
  failuresByLayer: { layer: string; failedRuns: number; totalRuns: number; failedPct: number }[];
  topFailingPipelines: { ConfigName: string; failure_count: number }[];
}

export interface TaskActivityTrends {
  runScope?: RunScopeContext | null;
  summary: {
    totalTasks: number;
    failedTasks: number;
    successTasks: number;
    failedTaskPct: number;
    rowsRead: number;
    rowsWritten: number;
    failingSites: number;
  };
  daily: {
    runDate: string;
    failedTasks: number;
    successTasks: number;
    totalTasks: number;
    failedTaskPct: number;
    rowsRead: number;
    rowsWritten: number;
  }[];
  topFailingSites: {
    SiteCode: string;
    failureCount: number;
    pipelineCount: number;
    lastFailure: string;
  }[];
}

export interface FailedTask {
  StartTime: string;
  ConfigName: string;
  TargetName?: string;
  SiteCode: string;
  DataBaseName: string;
  SiteName?: string;
  TaskName: string;
  TargetTable: string;
  Status: string;
  ErrorMessage: string;
  PipelineRunId: string;
  TaskId: string;
  fabricUrl?: string | null;
}

export interface NotificationAlert {
  Id: number;
  Status: string;
  PipelineName: string;
  ConfigName: string;
  SourceSystem: string;
  TargetName: string;
  EnvironmentName: string;
  RunId: string;
  PipelineRunId: string;
  FailedCount: number;
  StartTime: string;
  EndTime: string;
  ErrorSummary: string;
  FailureDetails: string;
  Title: string;
  Summary: string;
  Source: string;
  CreatedAt: string;
  fabricUrl?: string | null;
}

export interface NotificationSummary {
  totalAlerts: number;
  pipelines: number;
  failedTasks: number;
  byLayer: { BR: number; SL: number; GL: number };
}

export interface ChatResponse {
  intent: string;
  summary: string;
  columns: string[] | null;
  rows: Record<string, unknown>[] | null;
  deepLink: string | null;
  suggestedPrompts?: string[];
  toolsUsed?: string[];
  chatMode?: "agent" | "rules" | "rules_fallback";
}

export interface ChatRequestBody {
  question: string;
  refDate?: string;
  lookbackDays?: number;
  startDateFrom?: string;
  startDateTo?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}