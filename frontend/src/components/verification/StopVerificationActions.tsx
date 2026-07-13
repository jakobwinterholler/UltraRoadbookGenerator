import type { NearbyAlternativeStop } from "../../planning/stopVerification/nearbyAlternatives";

interface StopVerificationActionsProps {
  saving: boolean;
  currentPending: boolean;
  showAlternatives: boolean;
  inAlternativeBranch: boolean;
  onVerify: () => void;
  onReject: () => void;
  onLater: () => void;
  onVerifyAndAlternatives: () => void;
  onDontVerifyAndAlternatives: () => void;
}

export default function StopVerificationActions({
  saving,
  currentPending,
  showAlternatives,
  inAlternativeBranch,
  onVerify,
  onReject,
  onLater,
  onVerifyAndAlternatives,
  onDontVerifyAndAlternatives,
}: StopVerificationActionsProps) {
  const disabled = saving || !currentPending;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onVerify}
          disabled={disabled}
          className="rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          ✓ Verify
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
        >
          ✕ Reject
        </button>
        <button
          type="button"
          onClick={onLater}
          disabled={disabled}
          className="rounded-xl border border-line bg-card px-4 py-3.5 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-60"
        >
          Later
        </button>
      </div>

      {showAlternatives && !inAlternativeBranch && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onVerifyAndAlternatives}
            disabled={disabled}
            className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            ✓ Verify &amp; view alternatives
          </button>
          <button
            type="button"
            onClick={onDontVerifyAndAlternatives}
            disabled={disabled}
            className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60"
          >
            ✕ Don&apos;t verify &amp; view alternatives
          </button>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {inAlternativeBranch
          ? "← → navigate · Enter verify · Delete reject · Space later · Returns to route order when done"
          : "← → navigate · Enter verify · Delete reject · Space later"}
      </p>
    </div>
  );
}

export function formatAlternativeListPreview(alternatives: NearbyAlternativeStop[]): string {
  return alternatives.map((item) => `• ${item.displayName} (${item.positionLabel})`).join(" · ");
}
