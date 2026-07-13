export type ProgressStatus = "pending" | "active" | "complete" | "error";

export interface ProgressStepState {
  id: string;
  label: string;
  status: ProgressStatus;
  detail?: string;
}

export interface ProgressStepDefinition {
  id: string;
  label: string;
  active_label?: string | null;
}

export interface ProgressStepEvent {
  type: "step";
  step_id: string;
  status: "active" | "complete" | "error";
  label: string;
  detail?: string | null;
  step_index: number;
  total_steps: number;
}

export interface AnalysisCompleteEvent {
  type: "complete";
  data: unknown;
}

export interface AnalysisPartialEvent {
  type: "partial";
  slice: string;
  data: Record<string, unknown>;
}

export interface AnalysisPerformanceEvent {
  type: "performance";
  report: Array<{
    stage_id: string;
    label: string;
    duration_s: number;
    percent: number;
  }>;
}

export interface AnalysisErrorEvent {
  type: "error";
  detail: string;
}

export interface AnalysisProgressEvent {
  type: "progress";
  percent: number;
  stage_id?: string | null;
  label: string;
}

export interface AnalysisSubprogressEvent {
  type: "subprogress";
  stage_id: string;
  current: number;
  total: number;
  label: string;
}

export interface AnalysisStatsEvent {
  type: "stats";
  payload: Record<string, number | string | null>;
}

export interface AnalysisReadinessEvent {
  type: "readiness";
  slice: string;
  status: "waiting" | "running" | "ready";
}

export interface AnalysisLogEvent {
  type: "log";
  message: string;
  level?: string;
}

export type AnalysisStreamEvent =
  | ProgressStepEvent
  | AnalysisCompleteEvent
  | AnalysisPartialEvent
  | AnalysisPerformanceEvent
  | AnalysisProgressEvent
  | AnalysisSubprogressEvent
  | AnalysisStatsEvent
  | AnalysisReadinessEvent
  | AnalysisLogEvent
  | AnalysisErrorEvent;

export const STARTUP_STEPS: ProgressStepDefinition[] = [
  { id: "backend", label: "Backend started" },
  { id: "frontend", label: "Frontend ready" },
  { id: "application", label: "Loading application" },
  { id: "ready", label: "Ready" },
];

export function createInitialSteps(definitions: ProgressStepDefinition[]): ProgressStepState[] {
  return definitions.map((step) => ({
    id: step.id,
    label: step.label,
    status: "pending",
  }));
}

export function applyProgressEvent(
  steps: ProgressStepState[],
  event: ProgressStepEvent,
): ProgressStepState[] {
  const next = steps.map((step) => ({ ...step }));
  const index = next.findIndex((step) => step.id === event.step_id);

  if (index === -1) {
    next.push({
      id: event.step_id,
      label: event.label,
      status: event.status === "error" ? "error" : event.status === "complete" ? "complete" : "active",
      detail: event.detail ?? undefined,
    });
    return next;
  }

  if (event.status === "active") {
    for (let stepIndex = 0; stepIndex < index; stepIndex += 1) {
      if (next[stepIndex].status !== "complete" && next[stepIndex].status !== "error") {
        next[stepIndex].status = "complete";
      }
    }
    next[index] = {
      ...next[index],
      label: event.label,
      status: "active",
      detail: event.detail ?? undefined,
    };
    return next;
  }

  if (event.status === "complete") {
    next[index] = {
      ...next[index],
      label: event.label,
      status: "complete",
      detail: event.detail ?? undefined,
    };
    return next;
  }

  next[index] = {
    ...next[index],
    label: event.label,
    status: "error",
    detail: event.detail ?? undefined,
  };
  return next;
}

export function markStepComplete(
  steps: ProgressStepState[],
  stepId: string,
  detail?: string,
): ProgressStepState[] {
  return steps.map((step) => {
    if (step.id !== stepId) {
      return step;
    }
    return {
      ...step,
      status: "complete",
      detail,
    };
  });
}

export function markStepActive(
  steps: ProgressStepState[],
  stepId: string,
  label?: string,
): ProgressStepState[] {
  return steps.map((step) => {
    if (step.id === stepId) {
      return {
        ...step,
        label: label ?? step.label,
        status: "active",
      };
    }
    if (step.status === "active") {
      return {
        ...step,
        status: "complete",
      };
    }
    return step;
  });
}

export function completedStepCount(steps: ProgressStepState[]): number {
  return steps.filter((step) => step.status === "complete").length;
}

export function activeStep(steps: ProgressStepState[]): ProgressStepState | null {
  return steps.find((step) => step.status === "active") ?? null;
}

export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
