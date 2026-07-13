import { useEffect, useState } from "react";
import type { ProgressStepState } from "../progress";
import { activeStep, completedStepCount, formatElapsed } from "../progress";

interface ProgressStepsProps {
  title: string;
  subtitle?: string;
  steps: ProgressStepState[];
  startedAt: number;
  totalSteps?: number;
}

function StepIcon({ status }: { status: ProgressStepState["status"] }) {
  if (status === "complete") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        ✓
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
        !
      </span>
    );
  }

  return <span className="h-5 w-5 shrink-0 rounded-full border border-line bg-white" />;
}

export default function ProgressSteps({
  title,
  subtitle,
  steps,
  startedAt,
  totalSteps,
}: ProgressStepsProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      tick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const current = activeStep(steps);
  const completed = completedStepCount(steps);
  const resolvedTotal = totalSteps ?? steps.length;

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-card px-6 py-8 shadow-card">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 rounded-xl px-3 py-2 ${
              step.status === "active" ? "bg-accent/[0.06]" : ""
            }`}
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm ${
                  step.status === "pending"
                    ? "text-muted"
                    : step.status === "active"
                      ? "font-medium text-ink"
                      : "text-ink"
                }`}
              >
                {step.label}
                {step.status === "active" ? "..." : ""}
              </p>
              {step.detail && (
                <p className="mt-0.5 text-xs text-muted">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
        <span>
          Step {Math.min(completed + (current ? 1 : 0), resolvedTotal)} of {resolvedTotal}
        </span>
        {current && <span className="text-ink">{current.label}...</span>}
      </div>
    </div>
  );
}
