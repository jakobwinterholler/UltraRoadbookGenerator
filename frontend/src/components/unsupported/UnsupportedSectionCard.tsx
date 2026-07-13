import DifficultyStars from "../DifficultyStars";
import type { UnsupportedSection } from "../../planning/unsupportedSections";
import {
  availabilityLabel,
  riskTierForSection,
  unsupportedRiskMedal,
} from "../../planning/unsupportedSections";

interface UnsupportedSectionCardProps {
  section: UnsupportedSection;
  selected?: boolean;
  onSelect?: (sectionId: string) => void;
}

function stopLabel(stop: { name: string; km: number } | null, fallback: string): string {
  if (!stop) {
    return fallback;
  }
  return `${stop.name} · km ${Math.round(stop.km)}`;
}

export default function UnsupportedSectionCard({
  section,
  selected = false,
  onSelect,
}: UnsupportedSectionCardProps) {
  const tier = riskTierForSection(section);
  const medal = unsupportedRiskMedal(section.riskRank);
  const isTopThree = section.riskRank !== null && section.riskRank <= 3;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(section.id)}
      className={`flex h-full w-full flex-col rounded-2xl border text-left transition ${
        selected
          ? "border-accent ring-2 ring-accent/20"
          : `border-line ${tier.accentClass}`
      } ${medal?.ringClass ?? ""} ${isTopThree ? "p-5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold text-ink ${isTopThree ? "text-xl" : "text-lg"}`}>
            <span className="mr-2" aria-hidden>
              ⚠️
            </span>
            {section.displayLabel}
          </p>
          {medal && (
            <p className="mt-1 text-xs font-semibold text-muted">
              {medal.emoji} {medal.label}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tier.badgeClass}`}>
          {tier.label}
        </span>
      </div>

      <div className="mt-3">
        <DifficultyStars stars={tier.stars} starClassName={tier.starClass} />
        <p className="mt-1.5 text-sm font-medium text-ink">
          Risk <span className="tabular-nums">{section.riskScore}</span> / 100
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold tabular-nums text-ink">
        <span>{section.distanceKm.toFixed(0)} km</span>
        <span>+{section.elevationGainM.toLocaleString()} m</span>
        <span>−{section.elevationLossM.toLocaleString()} m</span>
        {section.gravelPct > 0 && <span>{section.gravelPct}% gravel</span>}
        {section.avgGradientPct !== null && <span>{section.avgGradientPct.toFixed(1)}% avg</span>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
        <span>Water: {availabilityLabel(section.waterAvailability)}</span>
        <span>Food: {availabilityLabel(section.foodAvailability)}</span>
        <span className="col-span-2 truncate">
          Before: {stopLabel(section.reliableWaterBefore ?? section.stopBefore, "Route start")}
        </span>
        <span className="col-span-2 truncate">
          After: {stopLabel(section.reliableWaterAfter ?? section.stopAfter, "Route finish")}
        </span>
      </div>

      {section.whyBadges.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line/70 pt-3">
          {section.whyBadges.map((badge) => (
            <p key={badge.id} className="text-sm font-medium text-ink">
              {badge.emoji} {badge.shortLabel}
            </p>
          ))}
        </div>
      )}

      <p className="mt-auto pt-3 text-xs font-semibold text-accent">View section details →</p>
    </button>
  );
}
