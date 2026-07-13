import type { VerifiedPlan } from "../../planning/stopVerification/verifiedPlan";
import {
  gapAvailabilityClass,
  gapAvailabilityLabel,
} from "../../planning/stopVerification/verifiedPlan";
import { VERIFICATION_BATCH_SIZE } from "../../planning/stopVerification/batchSelection";

interface VerificationOverviewHubProps {
  verifiedCount: number;
  remainingCandidates: number;
  batchPending: number;
  batchActive: boolean;
  batchComplete: boolean;
  roundNumber: number;
  plan: VerifiedPlan;
  onContinue: () => void;
  onFinishPlan: () => void;
}

export default function VerificationOverviewHub({
  verifiedCount,
  remainingCandidates,
  batchPending,
  batchActive,
  batchComplete,
  roundNumber,
  plan,
  onContinue,
  onFinishPlan,
}: VerificationOverviewHubProps) {
  const canVerifyMore = remainingCandidates > 0;
  const resumeInProgress = batchActive && !batchComplete && batchPending > 0;

  const continueLabel = resumeInProgress
    ? "Continue verification"
    : verifiedCount === 0
      ? "Verify next stops"
      : "Verify next stops";

  const continueDetail = resumeInProgress
    ? `${batchPending} stop${batchPending === 1 ? "" : "s"} left in round ${roundNumber}`
    : canVerifyMore
      ? `Up to ${Math.min(VERIFICATION_BATCH_SIZE, remainingCandidates)} stops targeting your weakest gaps`
      : null;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
      {plan.weakestGap && verifiedCount > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50/90 px-4 py-3 ring-1 ring-amber-200/60">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
            Biggest remaining weak section
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-amber-950">
            {plan.weakestGap.distanceKm} km · +{plan.weakestGap.elevationGainM} m ·{" "}
            {plan.weakestGap.gravelPct}% gravel
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            Food{" "}
            <span className={gapAvailabilityClass(plan.weakestGap.foodAvailability)}>
              {gapAvailabilityLabel(plan.weakestGap.foodAvailability)}
            </span>
            {" · "}
            Water{" "}
            <span className={gapAvailabilityClass(plan.weakestGap.waterAvailability)}>
              {gapAvailabilityLabel(plan.weakestGap.waterAvailability)}
            </span>
          </p>
        </div>
      )}

      {batchComplete && batchActive && (
        <p className="mb-4 text-sm font-medium text-ink">Round {roundNumber} complete</p>
      )}

      {canVerifyMore ? (
        <button
          type="button"
          onClick={onContinue}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-base font-semibold text-white transition hover:bg-accent/90"
        >
          <span aria-hidden>▶</span>
          {continueLabel}
        </button>
      ) : (
        <p className="text-sm text-muted">
          No more candidates to review. Finish when you trust your resupply strategy.
        </p>
      )}

      {continueDetail && canVerifyMore && (
        <p className="mt-2 text-center text-xs text-muted">{continueDetail}</p>
      )}

      {verifiedCount > 0 && (
        <button
          type="button"
          onClick={onFinishPlan}
          className="mt-4 w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
        >
          Finish verification
        </button>
      )}
    </section>
  );
}
