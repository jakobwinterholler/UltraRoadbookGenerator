import type { CompanionStop } from "../types";

/** Stops within this gap share a planning area for local alternatives (matches Desktop). */
export const PLANNING_AREA_KM = 12;

const MAX_NEARBY_ALTERNATIVES = 3;

export interface NearbyStopAlternative {
  stop: CompanionStop;
  positionLabel: string;
  distanceM: number;
}

function relativePositionLabel(anchorKm: number, alternativeKm: number): string {
  const deltaM = Math.round((alternativeKm - anchorKm) * 1000);
  if (Math.abs(deltaM) < 75) {
    return "nearby";
  }
  if (deltaM > 0) {
    return `${deltaM} m after`;
  }
  return `${Math.abs(deltaM)} m before`;
}

export function findNearbyStopAlternatives(
  anchor: CompanionStop,
  allStops: CompanionStop[],
): NearbyStopAlternative[] {
  const anchorKm = anchor.km;
  return allStops
    .filter(
      (stop) =>
        stop.zoneId !== anchor.zoneId &&
        Math.abs(stop.km - anchorKm) <= PLANNING_AREA_KM,
    )
    .map((stop) => ({
      stop,
      distanceM: Math.round(Math.abs(stop.km - anchorKm) * 1000),
      positionLabel: relativePositionLabel(anchorKm, stop.km),
    }))
    .sort((left, right) => left.distanceM - right.distanceM)
    .slice(0, MAX_NEARBY_ALTERNATIVES);
}
