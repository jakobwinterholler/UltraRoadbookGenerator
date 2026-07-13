import type { ClimbCandidateRow } from "../../api";
import { formatKm } from "../routeInsights";

interface CandidateContextSummaryProps {
  candidate: ClimbCandidateRow;
  onClose: () => void;
}

export default function CandidateContextSummary({ candidate, onClose }: CandidateContextSummaryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Rejected climb candidate</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            {candidate.rejection_label ?? "Rejected segment"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent/80"
        >
          Clear
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Length</dt>
          <dd className="font-medium tabular-nums text-ink">{formatKm(candidate.end_km - candidate.start_km, 1)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Position</dt>
          <dd className="font-medium tabular-nums text-ink">
            {candidate.start_km.toFixed(0)} → {candidate.end_km.toFixed(0)} km
          </dd>
        </div>
        {candidate.elevation_gain_m !== null && (
          <div>
            <dt className="text-xs text-muted">Gain</dt>
            <dd className="font-medium tabular-nums text-ink">+{Math.round(candidate.elevation_gain_m)} m</dd>
          </div>
        )}
      </dl>

      {candidate.rejection_reason && (
        <p className="mt-4 border-t border-line/60 pt-3 text-sm text-muted">{candidate.rejection_reason}</p>
      )}
    </div>
  );
}
