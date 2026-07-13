import type { AnalyzedClimb } from "../planning/climbAnalysis";
import { keyClimbMedal } from "../planning/climbAnalysis";
import { climbNameSourceLabel } from "../planning/climbLabels";
import DifficultyStars from "./DifficultyStars";

interface KeyClimbCardProps {
  climb: AnalyzedClimb;
  rank?: number | null;
  selected?: boolean;
  onSelect?: (climbId: string) => void;
}

function formatGradient(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export default function KeyClimbCard({
  climb,
  rank = climb.difficultyRank,
  selected = false,
  onSelect,
}: KeyClimbCardProps) {
  const medal = keyClimbMedal(rank);
  const isTopThree = rank !== null && rank <= 3;
  const nameSource = climbNameSourceLabel(climb.name_source);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(climb.id)}
      className={`flex h-full w-full flex-col rounded-2xl border text-left transition ${
        selected
          ? "border-accent ring-2 ring-accent/20"
          : `border-line ${climb.tier.accentClass}`
      } ${medal?.ringClass ?? ""} ${isTopThree ? "p-5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold text-ink ${isTopThree ? "text-xl" : "text-lg"}`}>
            <span className="mr-2" aria-hidden>
              🏔️
            </span>
            {climb.displayName}
          </p>
          {nameSource && (
            <p className="mt-0.5 text-[11px] font-medium text-muted">{nameSource}</p>
          )}
          {medal && (
            <p className="mt-1 text-xs font-semibold text-muted">
              {medal.emoji} {medal.label}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${climb.tier.badgeClass}`}>
          {climb.tier.label}
        </span>
      </div>

      <div className="mt-3">
        <DifficultyStars stars={climb.tier.stars} starClassName={climb.tier.starClass} />
        <p className="mt-1.5 text-sm font-medium text-ink">
          Difficulty <span className="tabular-nums">{climb.difficultyScore}</span> / 100
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold tabular-nums text-ink">
        <span>{climb.length_km.toFixed(1)} km</span>
        <span>+{climb.elevation_gain_m} m</span>
        <span>{climb.avg_gradient_pct.toFixed(1)}% avg</span>
      </div>

      {climb.whyBadges.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line/70 pt-3">
          {climb.whyBadges.map((badge) => (
            <p key={badge.id} className="text-sm font-medium text-ink">
              {badge.emoji} {badge.shortLabel}
            </p>
          ))}
        </div>
      )}

      <p className="mt-auto pt-3 text-xs font-semibold text-accent">View climb details →</p>
    </button>
  );
}

export function KeyClimbGradientMetrics({ climb }: { climb: AnalyzedClimb }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs tabular-nums text-muted sm:grid-cols-5">
      <span>50 m: {formatGradient(climb.max_50_m_pct)}</span>
      <span>100 m: {formatGradient(climb.max_100_m_pct)}</span>
      <span>250 m: {formatGradient(climb.max_250_m_pct)}</span>
      <span>500 m: {formatGradient(climb.max_500_m_pct)}</span>
      <span>1 km: {formatGradient(climb.max_1000_m_pct)}</span>
    </div>
  );
}
