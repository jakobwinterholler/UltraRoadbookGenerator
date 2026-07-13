import type { ResupplyZone, TrackPoint } from "../api";
import { zoneHasCategory } from "../components/routeInsights";

export interface ResupplyGap {
  id: string;
  label: string;
  icon: string;
  startKm: number;
  endKm: number;
  gapKm: number;
  elevationGainM: number;
}

export function elevationGainInKmRange(
  points: TrackPoint[],
  startKm: number,
  endKm: number,
): number {
  const inRange = points.filter((point) => point.km >= startKm && point.km <= endKm);
  if (inRange.length < 2) {
    return 0;
  }
  return Math.max(
    0,
    Math.round(inRange[inRange.length - 1].cumulative_gain_m - inRange[0].cumulative_gain_m),
  );
}

function longestCategoryGap(
  zones: ResupplyZone[],
  totalKm: number,
  category: "food" | "water",
): { startKm: number; endKm: number; gapKm: number } | null {
  const sorted = zones
    .filter((zone) => zoneHasCategory(zone, category))
    .sort((left, right) => left.distance_along_km - right.distance_along_km);

  const gaps: { startKm: number; endKm: number; gapKm: number }[] = [];

  if (sorted.length === 0) {
    return totalKm > 0 ? { startKm: 0, endKm: totalKm, gapKm: totalKm } : null;
  }

  gaps.push({
    startKm: 0,
    endKm: sorted[0].distance_along_km,
    gapKm: sorted[0].distance_along_km,
  });

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startKm = sorted[index].distance_along_km;
    const endKm = sorted[index + 1].distance_along_km;
    gaps.push({ startKm, endKm, gapKm: endKm - startKm });
  }

  const last = sorted[sorted.length - 1];
  gaps.push({
    startKm: last.distance_along_km,
    endKm: totalKm,
    gapKm: totalKm - last.distance_along_km,
  });

  return gaps.reduce((best, gap) => (gap.gapKm > best.gapKm ? gap : best));
}

export function buildResupplyGapInsights(
  zones: ResupplyZone[],
  trackPoints: TrackPoint[],
  totalKm: number,
): ResupplyGap[] {
  const gaps: ResupplyGap[] = [];

  const sortedZones = [...zones].sort(
    (left, right) => left.distance_along_km - right.distance_along_km,
  );
  if (sortedZones.length >= 2) {
    let longestUnsupported = {
      startKm: sortedZones[0].distance_along_km,
      endKm: sortedZones[1].distance_along_km,
      gapKm: sortedZones[1].distance_along_km - sortedZones[0].distance_along_km,
    };
    for (let index = 0; index < sortedZones.length - 1; index += 1) {
      const startKm = sortedZones[index].distance_along_km;
      const endKm = sortedZones[index + 1].distance_along_km;
      const gapKm = endKm - startKm;
      if (gapKm > longestUnsupported.gapKm) {
        longestUnsupported = { startKm, endKm, gapKm };
      }
    }
    if (longestUnsupported.gapKm >= 15) {
      gaps.push({
        id: "unsupported",
        label: "Longest unsupported section",
        icon: "⚠",
        ...longestUnsupported,
        elevationGainM: elevationGainInKmRange(
          trackPoints,
          longestUnsupported.startKm,
          longestUnsupported.endKm,
        ),
      });
    }
  }

  const foodGap = longestCategoryGap(zones, totalKm, "food");
  if (foodGap && foodGap.gapKm >= 20) {
    gaps.push({
      id: "food-gap",
      label: "Longest food gap",
      icon: "🍔",
      startKm: foodGap.startKm,
      endKm: foodGap.endKm,
      gapKm: foodGap.gapKm,
      elevationGainM: elevationGainInKmRange(trackPoints, foodGap.startKm, foodGap.endKm),
    });
  }

  const waterGap = longestCategoryGap(zones, totalKm, "water");
  if (waterGap && waterGap.gapKm >= 15) {
    gaps.push({
      id: "water-gap",
      label: "Longest water gap",
      icon: "💧",
      startKm: waterGap.startKm,
      endKm: waterGap.endKm,
      gapKm: waterGap.gapKm,
      elevationGainM: elevationGainInKmRange(trackPoints, waterGap.startKm, waterGap.endKm),
    });
  }

  return gaps.sort((left, right) => right.gapKm - left.gapKm);
}
