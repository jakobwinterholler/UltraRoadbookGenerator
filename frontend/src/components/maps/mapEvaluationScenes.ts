import type { ClimbRow, ResupplyZone, RouteVisualization } from "../../api";

export type EvaluationSceneId = "full" | "mountain" | "flat" | "urban" | "custom";

export interface EvaluationSceneRange {
  startKm: number;
  endKm: number;
  label: string;
  detail: string;
}

export interface EvaluationScenePreset {
  id: EvaluationSceneId;
  label: string;
  hint: string;
}

export const EVALUATION_SCENE_PRESETS: EvaluationScenePreset[] = [
  {
    id: "full",
    label: "Full route",
    hint: "Entire course with surrounding context",
  },
  {
    id: "mountain",
    label: "Mountainous",
    hint: "Highest-gain climb ± buffer",
  },
  {
    id: "flat",
    label: "Flatter",
    hint: "35 km window with the least elevation change",
  },
  {
    id: "urban",
    label: "Urban / town",
    hint: "Densest resupply hub ± buffer",
  },
];

const WINDOW_FLAT_KM = 35;
const MOUNTAIN_BUFFER_KM = 10;
const URBAN_BUFFER_KM = 8;

function clampRange(
  startKm: number,
  endKm: number,
  totalKm: number,
): { startKm: number; endKm: number } {
  const start = Math.max(0, startKm);
  const end = Math.min(totalKm, Math.max(endKm, start + 2));
  return { startKm: start, endKm: end };
}

export function resolveEvaluationSceneRange(
  route: RouteVisualization,
  climbs: ClimbRow[],
  zones: ResupplyZone[],
  sceneId: EvaluationSceneId,
  customRange?: { startKm: number; endKm: number } | null,
): EvaluationSceneRange | null {
  const points = route.track_points;
  if (points.length < 2) {
    return null;
  }

  const totalKm = points[points.length - 1].km;

  if (sceneId === "custom" && customRange) {
    const clamped = clampRange(customRange.startKm, customRange.endKm, totalKm);
    return {
      ...clamped,
      label: "Custom range",
      detail: `km ${Math.round(clamped.startKm)}–${Math.round(clamped.endKm)}`,
    };
  }

  if (sceneId === "full") {
    return {
      startKm: 0,
      endKm: totalKm,
      label: "Full route",
      detail: `${Math.round(totalKm)} km total`,
    };
  }

  if (sceneId === "mountain") {
    const climb =
      climbs.length > 0
        ? [...climbs].sort((a, b) => b.elevation_gain_m - a.elevation_gain_m)[0]
        : null;

    if (climb) {
      const clamped = clampRange(
        climb.start_km - MOUNTAIN_BUFFER_KM,
        climb.end_km + MOUNTAIN_BUFFER_KM,
        totalKm,
      );
      return {
        ...clamped,
        label: "Mountainous section",
        detail: `${climb.elevation_gain_m.toFixed(0)} m gain · km ${Math.round(climb.start_km)}–${Math.round(climb.end_km)}`,
      };
    }

    const bestWindow = findHighestElevationWindow(points, 25);
    if (bestWindow) {
      return {
        ...bestWindow,
        label: "Mountainous section",
        detail: "Highest elevation window (no climbs detected)",
      };
    }
  }

  if (sceneId === "flat") {
    const flatWindow = findFlattestWindow(points, WINDOW_FLAT_KM);
    if (flatWindow) {
      return {
        ...flatWindow,
        label: "Flatter section",
        detail: `${WINDOW_FLAT_KM} km with least elevation change`,
      };
    }
  }

  if (sceneId === "urban") {
    const zone =
      zones.length > 0
        ? [...zones].sort((a, b) => b.poi_count - a.poi_count)[0]
        : null;

    if (zone) {
      const clamped = clampRange(
        zone.distance_along_km - URBAN_BUFFER_KM,
        zone.distance_along_km + URBAN_BUFFER_KM,
        totalKm,
      );
      return {
        ...clamped,
        label: "Urban / town section",
        detail: `${zone.name} · ${zone.poi_count} POIs`,
      };
    }
  }

  return {
    startKm: 0,
    endKm: totalKm,
    label: "Full route",
    detail: "Fallback — no matching section found",
  };
}

function findFlattestWindow(
  points: RouteVisualization["track_points"],
  windowKm: number,
): { startKm: number; endKm: number } | null {
  if (points.length < 2) {
    return null;
  }

  let bestStart = points[0].km;
  let bestEnd = points[0].km + windowKm;
  let bestRange = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const startKm = points[index].km;
    const endKm = startKm + windowKm;
    const windowPoints = points.filter((point) => point.km >= startKm && point.km <= endKm);
    if (windowPoints.length < 2) {
      continue;
    }

    const elevations = windowPoints
      .map((point) => point.ele_m)
      .filter((value): value is number => value !== null);
    if (elevations.length < 2) {
      continue;
    }

    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const range = maxEle - minEle;
    if (range < bestRange) {
      bestRange = range;
      bestStart = startKm;
      bestEnd = endKm;
    }
  }

  if (!Number.isFinite(bestRange)) {
    return null;
  }

  return { startKm: bestStart, endKm: bestEnd };
}

function findHighestElevationWindow(
  points: RouteVisualization["track_points"],
  windowKm: number,
): { startKm: number; endKm: number } | null {
  let bestStart = 0;
  let bestMean = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const startKm = points[index].km;
    const endKm = startKm + windowKm;
    const windowPoints = points.filter((point) => point.km >= startKm && point.km <= endKm);
    const elevations = windowPoints
      .map((point) => point.ele_m)
      .filter((value): value is number => value !== null);
    if (elevations.length === 0) {
      continue;
    }
    const mean = elevations.reduce((sum, value) => sum + value, 0) / elevations.length;
    if (mean > bestMean) {
      bestMean = mean;
      bestStart = startKm;
    }
  }

  if (!Number.isFinite(bestMean)) {
    return null;
  }

  return { startKm: bestStart, endKm: bestStart + windowKm };
}
