import { VerificationStatusLegendItem } from "./VerificationStatusBadge";
import { VERIFICATION_STATUS_ORDER } from "../../planning/stopVerification/verificationStatusPresentation";

interface StopVerificationProgressProps {
  verified: number;
  total: number;
  remaining: number;
  estimatedMinutes: number;
}

export default function StopVerificationProgress({
  verified,
  total,
  remaining,
  estimatedMinutes,
}: StopVerificationProgressProps) {
  const fraction = total > 0 ? verified / total : 0;

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {VERIFICATION_STATUS_ORDER.map((status) => (
          <VerificationStatusLegendItem key={status} status={status} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Verified</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {verified}
            <span className="text-base font-normal text-muted"> / {total}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Remaining</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{remaining}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Estimated</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {estimatedMinutes}
            <span className="text-base font-normal text-muted"> min</span>
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/60">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
