import type { VerifiedPlan } from "../../planning/stopVerification/verifiedPlan";
import { VERIFICATION_BATCH_SIZE } from "../../planning/stopVerification/batchSelection";

interface VerificationRoundPanelProps {
  roundNumber: number;
  batchSize: number;
  batchPending: number;
  batchActive: boolean;
  batchComplete: boolean;
  remainingCandidates: number;
  plan: VerifiedPlan;
  onStartBatch: () => void;
  onFinishPlan: () => void;
}

export default function VerificationRoundPanel({
  roundNumber,
  batchSize,
  batchPending,
  batchActive,
  batchComplete,
  remainingCandidates,
  plan,
  onStartBatch,
  onFinishPlan,
}: VerificationRoundPanelProps) {
  const canLoadMore = remainingCandidates > 0;
  const showBatchComplete = batchComplete && batchActive;

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {batchActive ? `Round ${roundNumber}` : "Next round"}
          </p>
          {batchActive && !showBatchComplete && (
            <p className="mt-1 text-sm text-ink">
              {batchPending} stop{batchPending === 1 ? "" : "s"} left in this batch
            </p>
          )}
          {showBatchComplete && (
            <p className="mt-1 text-sm font-medium text-ink">Round {roundNumber} complete</p>
          )}
          {!batchActive && (
            <p className="mt-1 text-sm text-muted">
              Load up to {Math.min(batchSize, remainingCandidates)} candidates that strengthen your
              weakest gaps
            </p>
          )}
        </div>
      </div>

      {showBatchComplete && plan.weakestGap && (
        <div className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
          <p className="font-medium">Biggest remaining gap</p>
          <p className="mt-0.5 tabular-nums">
            {plan.weakestGap.distanceKm} km · +{plan.weakestGap.elevationGainM} m ·{" "}
            {plan.weakestGap.gravelPct}% gravel
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!batchActive && canLoadMore && (
          <button
            type="button"
            onClick={onStartBatch}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            {roundNumber === 0
              ? `Start round 1 (${Math.min(VERIFICATION_BATCH_SIZE, remainingCandidates)} stops)`
              : `Load next batch (${Math.min(VERIFICATION_BATCH_SIZE, remainingCandidates)})`}
          </button>
        )}

        {showBatchComplete && canLoadMore && (
          <button
            type="button"
            onClick={onStartBatch}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Load next batch ({Math.min(VERIFICATION_BATCH_SIZE, remainingCandidates)})
          </button>
        )}

        {plan.stops.length > 0 && (
          <button
            type="button"
            onClick={onFinishPlan}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
          >
            Finish verification
          </button>
        )}
      </div>

      {!canLoadMore && plan.stops.length > 0 && !batchActive && (
        <p className="mt-3 text-xs text-muted">
          No more candidates to review. Finish when you trust your resupply strategy.
        </p>
      )}
    </section>
  );
}
