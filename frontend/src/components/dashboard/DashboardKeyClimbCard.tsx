import type { AnalyzedClimb } from "../../planning/climbAnalysis";
import DifficultyStars from "../DifficultyStars";

interface DashboardKeyClimbCardProps {
  climb: AnalyzedClimb;
  rank: number;
  onSelect: (climbId: string) => void;
}

export default function DashboardKeyClimbCard({
  climb,
  rank,
  onSelect,
}: DashboardKeyClimbCardProps) {
  const isTopThree = rank <= 3;

  return (
    <button
      type="button"
      onClick={() => onSelect(climb.id)}
      className="group flex h-full w-full flex-col rounded-xl border border-line/40 bg-white p-5 text-left transition hover:border-line/80 hover:bg-canvas/40 md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            #{rank} hardest
          </p>
          <p
            className={`mt-1.5 font-semibold tracking-tight text-ink ${
              isTopThree ? "text-xl" : "text-lg"
            }`}
          >
            {climb.displayName}
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">
            km {Math.round(climb.start_km)}–{Math.round(climb.end_km)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <DifficultyStars stars={climb.tier.stars} starClassName="text-amber-500" />
          <p className="mt-1 text-xs text-muted">
            {climb.tier.label}
            <span className="mx-1 text-line">·</span>
            <span className="tabular-nums">{climb.difficultyScore}</span>/100
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-ink">
        <span>{climb.length_km.toFixed(1)} km</span>
        <span>+{climb.elevation_gain_m} m</span>
        <span>{climb.avg_gradient_pct.toFixed(1)}% avg</span>
      </div>

      {climb.whyBadges.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {climb.whyBadges.map((badge) => badge.shortLabel).join(" · ")}
        </p>
      )}

      <p className="mt-auto pt-4 text-sm text-accent opacity-0 transition group-hover:opacity-100">
        Open on map →
      </p>
    </button>
  );
}
