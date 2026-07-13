import type { ProgressStepState } from "../progress";
import { activeStep } from "../progress";
import ProgressSteps from "./ProgressSteps";

interface LoadingViewProps {
  startedAt: number;
  steps: ProgressStepState[];
  totalSteps: number;
}

export default function LoadingView({ startedAt, steps, totalSteps }: LoadingViewProps) {
  const current = activeStep(steps);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 lg:py-24">
      <ProgressSteps
        title="Analyzing route"
        subtitle={
          current
            ? `${current.label}...`
            : "Running the analysis pipeline"
        }
        steps={steps}
        startedAt={startedAt}
        totalSteps={totalSteps}
      />
    </div>
  );
}
