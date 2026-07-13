export type PrepareStepStatus = "pending" | "running" | "complete" | "error";

export interface PrepareStep {
  id: string;
  label: string;
  status: PrepareStepStatus;
}

export const DEFAULT_PREPARE_STEPS: PrepareStep[] = [
  { id: "story", label: "Preparing story", status: "pending" },
  { id: "scenes", label: "Preparing scenes", status: "pending" },
  { id: "terrain", label: "Preparing terrain", status: "pending" },
];

export function statusIcon(status: PrepareStepStatus): string {
  if (status === "complete") {
    return "✓";
  }
  if (status === "running") {
    return "⏳";
  }
  if (status === "error") {
    return "!";
  }
  return "○";
}

/** Rough per-step seconds for ETA when tile progress is unavailable. */
const STEP_ESTIMATE_S: Record<string, number> = {
  story: 6,
  scenes: 2,
  terrain: 45,
};

export function estimateRemainingSeconds(
  steps: PrepareStep[],
  progress: { id?: string; current?: number; total?: number } | null,
  startedAtMs: number | null,
): number | null {
  const running = steps.find((step) => step.status === "running");
  if (!running) {
    const pending = steps.filter((step) => step.status === "pending");
    if (pending.length === 0) {
      return null;
    }
    return pending.reduce((sum, step) => sum + (STEP_ESTIMATE_S[step.id] ?? 10), 0);
  }

  if (running.id === "terrain" && progress?.current && progress?.total) {
    const elapsed = startedAtMs ? (Date.now() - startedAtMs) / 1000 : 0;
    const rate = progress.current / Math.max(elapsed, 1);
    const remaining = (progress.total - progress.current) / Math.max(rate, 0.1);
    const pendingOther = steps
      .filter((step) => step.status === "pending")
      .reduce((sum, step) => sum + (STEP_ESTIMATE_S[step.id] ?? 5), 0);
    return Math.max(0, Math.round(remaining + pendingOther));
  }

  const pending = steps.filter((step) => step.status === "pending" || step.status === "running");
  return pending.reduce((sum, step) => sum + (STEP_ESTIMATE_S[step.id] ?? 10), 0);
}

export function formatEta(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }
  if (seconds < 5) {
    return "Less than 5 seconds remaining";
  }
  if (seconds < 60) {
    return `About ${seconds} seconds remaining`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `About ${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
}

export function mergePrepareSteps(
  incoming: PrepareStep[],
  progressLabel?: string,
): PrepareStep[] {
  const base = DEFAULT_PREPARE_STEPS.map((step) => {
    const match = incoming.find((item) => item.id === step.id);
    return match ? { ...step, ...match } : step;
  });
  for (const item of incoming) {
    if (!base.some((step) => step.id === item.id)) {
      base.push(item);
    }
  }
  if (progressLabel) {
    const terrain = base.find((step) => step.id === "terrain" && step.status === "running");
    if (terrain) {
      terrain.label = progressLabel;
    }
  }
  return base;
}
