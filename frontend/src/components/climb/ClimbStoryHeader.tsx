import type { ClimbRow } from "../../api";
import { climbNameSourceLabel } from "../../planning/climbLabels";
import type { AnalyzedClimb } from "../../planning/climbAnalysis";
import DifficultyStars from "../DifficultyStars";

interface ClimbStoryHeaderProps {
  climb: ClimbRow;
  analyzed: AnalyzedClimb;
}

export default function ClimbStoryHeader({ climb, analyzed }: ClimbStoryHeaderProps) {
  const nameSource = climbNameSourceLabel(climb.name_source);

  return (
    <header className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{analyzed.displayName}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DifficultyStars stars={analyzed.tier.stars} starClassName="text-amber-500" />
          <span className="text-sm font-medium text-ink">{analyzed.tier.label}</span>
        </div>
        {nameSource && <p className="mt-1 text-sm text-muted">{nameSource}</p>}
      </div>

      <p className="text-base tabular-nums text-ink">
        <span className="font-semibold">{climb.length_km.toFixed(1)} km</span>
        <span className="mx-2 text-line">·</span>
        <span className="font-semibold">+{climb.elevation_gain_m} m</span>
        <span className="mx-2 text-line">·</span>
        <span className="font-semibold">{climb.avg_gradient_pct.toFixed(1)}%</span>
        <span className="ml-1 text-muted">avg</span>
      </p>

      {analyzed.whyBadges.length > 0 && (
        <p className="text-sm text-muted">
          {analyzed.whyBadges.map((badge) => badge.shortLabel).join(" · ")}
        </p>
      )}
    </header>
  );
}
