import type { AnalysisState } from "../../analysis/analysisState";
import {
  deriveRacePreparationSteps,
  preparationPercent,
  type RacePreparationStepStatus,
} from "../../analysis/racePreparationSteps";
import {
  deriveRacePreparationSubSteps,
  hasGranularSubSteps,
} from "../../analysis/racePreparationSubSteps";

interface RacePreparationProgressProps {
  state: AnalysisState;
  title?: string;
}

function StepIcon({ status }: { status: RacePreparationStepStatus }) {
  if (status === "ready") {
    return <span className="text-success">✓</span>;
  }
  if (status === "running") {
    return (
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/30" />
        <span className="relative text-sm text-accent">⏳</span>
      </span>
    );
  }
  return <span className="text-muted/40">○</span>;
}

function SubStepIcon({ status }: { status: RacePreparationStepStatus }) {
  if (status === "ready") {
    return <span className="text-success">✓</span>;
  }
  if (status === "running") {
    return (
      <span className="relative flex h-3 w-3 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/25" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="text-muted/35">○</span>;
}

export default function RacePreparationProgress({
  state,
  title = "Preparing race…",
}: RacePreparationProgressProps) {
  const steps = deriveRacePreparationSteps(state);
  const percent = preparationPercent(state);

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-sm font-medium tabular-nums text-muted">{percent}%</p>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const subSteps =
            step.status === "running" && hasGranularSubSteps(step.id)
              ? deriveRacePreparationSubSteps(step.id, state)
              : [];

          return (
          <li key={step.id}>
            <div className="flex items-center gap-3">
              <span className="flex w-4 shrink-0 justify-center">
                <StepIcon status={step.status} />
              </span>
              <span
                className={`text-sm ${
                  step.status === "running"
                    ? "font-medium text-ink"
                    : step.status === "ready"
                      ? "text-muted"
                      : "text-muted/60"
                }`}
              >
                {step.label}
              </span>
            </div>
            {subSteps.length > 0 && (
              <ul className="ml-7 mt-1.5 space-y-1 border-l border-line/70 pl-3">
                {subSteps.map((subStep) => (
                  <li key={subStep.id}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex w-3 shrink-0 justify-center">
                        <SubStepIcon status={subStep.status} />
                      </span>
                      <span
                        className={`text-xs ${
                          subStep.status === "running"
                            ? "font-medium text-ink"
                            : subStep.status === "ready"
                              ? "text-muted"
                              : "text-muted/50"
                        }`}
                      >
                        {subStep.label}
                      </span>
                    </div>
                    {subStep.status === "running" && subStep.detail && (
                      <p className="ml-5 mt-0.5 text-[11px] text-muted">{subStep.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {step.status === "running" && step.hint && subSteps.length === 0 && (
              <p className="ml-7 mt-1 text-xs text-muted">{step.hint}</p>
            )}
          </li>
          );
        })}
      </ul>

      {state.error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
    </section>
  );
}
