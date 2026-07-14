import { useMemo } from "react";
import type { CompanionUnsupportedSection } from "../types";
import {
  estimateCarbsNeededG,
  estimateWaterNeededMl,
  formatRidingTime,
  unsupportedRiskBand,
} from "@shared/race/riderAssumptions";
import { bundleAssumptions } from "../lib/raceExecution";
import type { CompanionBundle } from "../types";
import BottomSheet from "./BottomSheet";

interface UnsupportedSectionSheetProps {
  section: CompanionUnsupportedSection | null;
  bundle: CompanionBundle;
  onClose: () => void;
}

function riskTone(band: string): string {
  if (band === "High") {
    return "text-red-300";
  }
  if (band === "Medium") {
    return "text-amber-200";
  }
  return "text-emerald-300";
}

export default function UnsupportedSectionSheet({
  section,
  bundle,
  onClose,
}: UnsupportedSectionSheetProps) {
  const analysis = useMemo(() => {
    if (!section) {
      return null;
    }
    const assumptions = bundleAssumptions(bundle);
    const hours =
      section.estimatedRidingHours ??
      section.distanceKm / assumptions.ridingSpeedKmh;
    const elevation = section.elevationGainM ?? 0;
    const band =
      section.riskBand ?? unsupportedRiskBand(section.distanceKm, elevation, assumptions);
    return {
      hours,
      elevation,
      band,
      waterMl: section.waterNeededMl ?? estimateWaterNeededMl(section.distanceKm, elevation, assumptions),
      carbsG: section.carbsNeededG ?? estimateCarbsNeededG(section.distanceKm, elevation, assumptions),
    };
  }, [bundle, section]);

  return (
    <BottomSheet open={section !== null} onClose={onClose}>
      {section && analysis ? (
        <div className="space-y-5 pb-2">
          <div>
            <p className="text-lg font-semibold text-white">Unsupported section</p>
            <p className="mt-1 text-sm text-white/55">{section.displayLabel}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-white/40">Distance</dt>
              <dd className="font-semibold tabular-nums text-white">{Math.round(section.distanceKm)} km</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Riding time</dt>
              <dd className="font-semibold text-white">{formatRidingTime(analysis.hours)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Climbing</dt>
              <dd className="font-semibold tabular-nums text-white">+{analysis.elevation.toLocaleString()} m</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Risk</dt>
              <dd className={`font-semibold ${riskTone(analysis.band)}`}>{analysis.band}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Water needed</dt>
              <dd className="font-semibold tabular-nums text-white">
                {(analysis.waterMl / 1000).toFixed(1)} L
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Carbs needed</dt>
              <dd className="font-semibold tabular-nums text-white">{analysis.carbsG} g</dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-white/45">
            Estimates use your planning assumptions ({bundleAssumptions(bundle).ridingSpeedKmh} km/h,
            {" "}
            {bundleAssumptions(bundle).waterMlPerHour} ml/h water,
            {" "}
            {bundleAssumptions(bundle).carbsGPerHour} g/h carbs).
          </p>
        </div>
      ) : null}
    </BottomSheet>
  );
}
