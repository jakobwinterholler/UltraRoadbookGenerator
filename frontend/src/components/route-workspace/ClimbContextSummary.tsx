import type { ClimbRow } from "../../api";
import { analyzeClimbs } from "../../planning/climbAnalysis";
import { climbDisplayName, climbNameSourceLabel } from "../../planning/climbLabels";
import DifficultyStars from "../DifficultyStars";

interface ClimbContextSummaryProps {
  climb: ClimbRow;
  onClose: () => void;
}

export default function ClimbContextSummary({ climb, onClose }: ClimbContextSummaryProps) {
  const analyzed = analyzeClimbs([climb])[0];
  const nameSource = climbNameSourceLabel(climb.name_source);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Selected climb</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{climbDisplayName(climb, 0)}</h3>
          {nameSource && <p className="mt-0.5 text-xs text-muted">{nameSource}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent/80"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <DifficultyStars stars={analyzed.tier.stars} starClassName={analyzed.tier.starClass} />
          <p className="mt-1 text-sm text-ink">
            {analyzed.tier.label} · difficulty {analyzed.difficultyScore}/100
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted">Length</dt>
            <dd className="font-medium tabular-nums text-ink">{climb.length_km.toFixed(1)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Gain</dt>
            <dd className="font-medium tabular-nums text-ink">+{climb.elevation_gain_m} m</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Avg gradient</dt>
            <dd className="font-medium tabular-nums text-ink">{climb.avg_gradient_pct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Position</dt>
            <dd className="font-medium tabular-nums text-ink">
              {climb.start_km.toFixed(0)} → {climb.end_km.toFixed(0)} km
            </dd>
          </div>
        </dl>

        {analyzed.whyBadges.length > 0 && (
          <div className="space-y-1 border-t border-line/60 pt-3">
            <p className="text-xs text-muted">Why it matters</p>
            {analyzed.whyBadges.map((badge) => (
              <p key={badge.id} className="text-sm text-ink">
                {badge.shortLabel}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
