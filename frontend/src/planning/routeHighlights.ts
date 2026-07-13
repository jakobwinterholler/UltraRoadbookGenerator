import type { ClimbRow, ResupplyZone, RouteVisualization } from "../api";
import { zoneHasCategory } from "../components/routeInsights";
import { analyzeClimbs, selectKeyClimbs } from "./climbAnalysis";

export interface RouteHighlight {
  id: string;
  emoji: string;
  label: string;
  value: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  /** Optional km hint for briefing rows (e.g. "km 142") */
  kmHint?: string;
  /** Km along route for overview map markers */
  focusKm?: number;
  /** Start/end km for dashboard route segment highlighting */
  segmentStartKm?: number;
  segmentEndKm?: number;
  /** Short planning insight shown on dashboard briefing cards */
  insightHint?: string;
}

const MAX_HIGHLIGHTS = 8;

export interface CategoryGap {
  gapKm: number;
  startKm: number;
  endKm: number;
}

function longestCategoryGap(
  zones: ResupplyZone[],
  totalKm: number,
  category: "food" | "water",
): CategoryGap | null {
  const sorted = zones
    .filter((zone) => zoneHasCategory(zone, category))
    .sort((left, right) => left.distance_along_km - right.distance_along_km);

  const gaps: CategoryGap[] = [];

  if (sorted.length === 0) {
    return totalKm > 0 ? { gapKm: totalKm, startKm: 0, endKm: totalKm } : null;
  }

  gaps.push({
    gapKm: sorted[0].distance_along_km,
    startKm: 0,
    endKm: sorted[0].distance_along_km,
  });

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startKm = sorted[index].distance_along_km;
    const endKm = sorted[index + 1].distance_along_km;
    gaps.push({
      gapKm: endKm - startKm,
      startKm,
      endKm,
    });
  }

  const last = sorted[sorted.length - 1];
  gaps.push({
    gapKm: totalKm - last.distance_along_km,
    startKm: last.distance_along_km,
    endKm: totalKm,
  });

  return gaps.reduce((best, gap) => (gap.gapKm > best.gapKm ? gap : best));
}

function longestGravelSegment(
  route: RouteVisualization,
): { lengthKm: number; startKm: number; endKm: number } | null {
  const gravelSegments = route.surface_segments.filter(
    (segment) => (segment.rider_category ?? segment.surface) === "Gravel",
  );
  if (gravelSegments.length === 0) {
    return null;
  }

  return gravelSegments.reduce(
    (best, segment) => {
      const lengthKm = segment.end_km - segment.start_km;
      if (lengthKm <= best.lengthKm) {
        return best;
      }
      return {
        lengthKm,
        startKm: segment.start_km,
        endKm: segment.end_km,
      };
    },
    { lengthKm: 0, startKm: 0, endKm: 0 },
  );
}

function highestPoint(
  route: RouteVisualization,
): { elevationM: number; km: number } | null {
  let best: { elevationM: number; km: number } | null = null;

  for (const point of route.track_points) {
    if (point.ele_m === null) {
      continue;
    }
    if (!best || point.ele_m > best.elevationM) {
      best = { elevationM: point.ele_m, km: point.km };
    }
  }

  return best;
}

function formatKmRange(startKm: number, endKm: number): string {
  return `KM ${Math.round(startKm)} → ${Math.round(endKm)}`;
}

export function buildRouteHighlights(
  climbs: ClimbRow[],
  zones: ResupplyZone[],
  route: RouteVisualization,
  totalKm: number,
): RouteHighlight[] {
  const highlights: RouteHighlight[] = [];
  const analyzed = analyzeClimbs(climbs);
  const keyClimbs = selectKeyClimbs(analyzed);

  if (keyClimbs.length > 0) {
    const hardest = keyClimbs[0];
    highlights.push({
      id: "hardest-climb",
      emoji: "🏔",
      label: "Hardest climb",
      value: hardest.displayName,
      detail: `${hardest.length_km.toFixed(1)} km · +${hardest.elevation_gain_m} m`,
      severity: hardest.difficultyScore >= 70 ? "danger" : "warning",
      kmHint: `km ${Math.round((hardest.start_km + hardest.end_km) / 2)}`,
      focusKm: (hardest.start_km + hardest.end_km) / 2,
      segmentStartKm: hardest.start_km,
      segmentEndKm: hardest.end_km,
      insightHint: `${hardest.avg_gradient_pct.toFixed(1)}% avg gradient`,
    });
  }

  const longestClimb = [...analyzed].sort((left, right) => right.length_km - left.length_km)[0];
  if (longestClimb && longestClimb.id !== keyClimbs[0]?.id) {
    highlights.push({
      id: "longest-climb",
      emoji: "⛰",
      label: "Longest climb",
      value: `${longestClimb.length_km.toFixed(1)} km`,
      detail: `${longestClimb.displayName} · +${longestClimb.elevation_gain_m} m`,
      severity: longestClimb.length_km >= 20 ? "warning" : "info",
      kmHint: `km ${Math.round((longestClimb.start_km + longestClimb.end_km) / 2)}`,
      focusKm: (longestClimb.start_km + longestClimb.end_km) / 2,
      segmentStartKm: longestClimb.start_km,
      segmentEndKm: longestClimb.end_km,
      insightHint: longestClimb.displayName,
    });
  }

  const foodGap = longestCategoryGap(zones, totalKm, "food");
  if (foodGap && foodGap.gapKm >= 20) {
    highlights.push({
      id: "food-gap",
      emoji: "🍔",
      label: "Longest food gap",
      value: `${foodGap.gapKm.toFixed(0)} km`,
      detail: formatKmRange(foodGap.startKm, foodGap.endKm),
      severity: foodGap.gapKm >= 40 ? "danger" : "warning",
      kmHint: `km ${Math.round((foodGap.startKm + foodGap.endKm) / 2)}`,
      focusKm: (foodGap.startKm + foodGap.endKm) / 2,
      segmentStartKm: foodGap.startKm,
      segmentEndKm: foodGap.endKm,
      insightHint: "Plan supplies carefully",
    });
  }

  const waterGap = longestCategoryGap(zones, totalKm, "water");
  if (waterGap && waterGap.gapKm >= 15) {
    highlights.push({
      id: "water-gap",
      emoji: "💧",
      label: "Longest water gap",
      value: `${waterGap.gapKm.toFixed(0)} km`,
      detail: formatKmRange(waterGap.startKm, waterGap.endKm),
      severity: waterGap.gapKm >= 30 ? "danger" : "warning",
      kmHint: `km ${Math.round((waterGap.startKm + waterGap.endKm) / 2)}`,
      focusKm: (waterGap.startKm + waterGap.endKm) / 2,
      segmentStartKm: waterGap.startKm,
      segmentEndKm: waterGap.endKm,
      insightHint: "No reliable water",
    });
  }

  const gravel = longestGravelSegment(route);
  if (gravel && gravel.lengthKm >= 8) {
    highlights.push({
      id: "gravel-section",
      emoji: "🪨",
      label: "Longest gravel",
      value: `${gravel.lengthKm.toFixed(1)} km`,
      detail: formatKmRange(gravel.startKm, gravel.endKm),
      severity: gravel.lengthKm >= 20 ? "warning" : "info",
      kmHint: `km ${Math.round((gravel.startKm + gravel.endKm) / 2)}`,
      focusKm: (gravel.startKm + gravel.endKm) / 2,
      segmentStartKm: gravel.startKm,
      segmentEndKm: gravel.endKm,
      insightHint: "Loose gravel",
    });
  }

  const summit = highestPoint(route);
  if (summit && summit.elevationM >= 500) {
    highlights.push({
      id: "highest-point",
      emoji: "📍",
      label: "Highest point",
      value: `${Math.round(summit.elevationM)} m`,
      detail: `Around km ${Math.round(summit.km)}`,
      severity: summit.elevationM >= 2000 ? "warning" : "info",
      kmHint: `km ${Math.round(summit.km)}`,
      focusKm: summit.km,
      segmentStartKm: Math.max(0, summit.km - 3),
      segmentEndKm: Math.min(totalKm, summit.km + 3),
      insightHint: "Route high point",
    });
  }

  return highlights.slice(0, MAX_HIGHLIGHTS);
}

const SEVERITY_RANK: Record<RouteHighlight["severity"], number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

/** Top N briefing items for compact Route sidebar orientation. */
export function topBriefingHighlights(highlights: RouteHighlight[], count: number): RouteHighlight[] {
  return [...highlights]
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity])
    .slice(0, count);
}

/** Dashboard overview — all challenge highlights sorted by severity. */
export function dashboardOverviewHighlights(highlights: RouteHighlight[]): RouteHighlight[] {
  return [...highlights].sort(
    (left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity],
  );
}
