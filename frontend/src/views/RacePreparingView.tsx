import { useState } from "react";
import type { AnalysisState } from "../analysis/analysisState";
import AnalysisDetailsPanel from "../components/races/AnalysisDetailsPanel";
import RacePreparationProgress from "../components/races/RacePreparationProgress";

interface RacePreparingViewProps {
  raceName: string;
  state: AnalysisState;
  startedAt: number;
  onCancel?: () => void;
}

export default function RacePreparingView({
  raceName,
  state,
  startedAt,
  onCancel,
}: RacePreparingViewProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`mx-auto px-6 py-10 ${showDetails ? "max-w-6xl" : "max-w-lg"}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">New race</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">{raceName}</h1>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            {state.error ? "Back to My Races" : "Cancel"}
          </button>
        )}
      </div>

      <RacePreparationProgress state={state} />

      {!state.error && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="text-sm text-muted underline-offset-2 transition hover:text-ink hover:underline"
          >
            {showDetails ? "Hide analysis details" : "Show analysis details"}
          </button>
        </div>
      )}

      {showDetails && !state.error && (
        <AnalysisDetailsPanel state={state} startedAt={startedAt} />
      )}
    </div>
  );
}
