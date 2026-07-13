import type { ResupplyZone } from "../api";
import type {
  DetourFilter,
  LegendItem,
  OverlayMode,
  ResupplyCategoryFilter,
  ResupplySortMode,
  RouteSegmentSource,
  TimeMode,
} from "./types";
import { zoneIsNightUseful, zoneMinDetourM } from "./zonePresentation";
import { computeUltraStopScore } from "./stopPresentation";

const NORMAL_ROUTE_COLOR = "#E85D04";

export const SURFACE_LEGEND: LegendItem[] = [
  { label: "Road", color: "#2563eb" },
  { label: "Gravel", color: "#854d0e" },
  { label: "Trail", color: "#16a34a" },
  { label: "Unknown", color: "#ef4444" },
];

export const RESUPPLY_LEGEND: LegendItem[] = [
  { label: "Excellent", color: "#22c55e" },
  { label: "Good", color: "#eab308" },
  { label: "Limited", color: "#f97316" },
  { label: "Poor", color: "#ef4444" },
];

export const NIGHT_LEGEND: LegendItem[] = [
  { label: "Available", color: "#22c55e" },
  { label: "Water", color: "#3b82f6" },
  { label: "Closed", color: "#9ca3af" },
];

export function legendForView(overlay: OverlayMode, timeMode: TimeMode): LegendItem[] {
  if (timeMode === "night") {
    return NIGHT_LEGEND;
  }
  if (overlay === "surface") {
    return SURFACE_LEGEND;
  }
  if (overlay === "resupply") {
    return RESUPPLY_LEGEND;
  }
  return [];
}

export function routeSegmentsForOverlay({ route, overlay }: RouteSegmentSource) {
  if (overlay === "surface") {
    return route.surface_segments.map((segment) => ({
      start_km: segment.start_km,
      end_km: segment.end_km,
      color: segment.color,
      label: segment.surface,
    }));
  }
  if (overlay === "resupply") {
    return route.resupply_segments.map((segment) => ({
      start_km: segment.start_km,
      end_km: segment.end_km,
      color: segment.color,
      label: segment.label,
    }));
  }
  return [
    {
      start_km: route.track_points[0]?.km ?? 0,
      end_km: route.track_points[route.track_points.length - 1]?.km ?? 0,
      color: NORMAL_ROUTE_COLOR,
      label: "Route",
    },
  ];
}

export function colorAtKm(
  km: number,
  segments: { start_km: number; end_km: number; color: string }[],
  fallback = NORMAL_ROUTE_COLOR,
): string {
  for (const segment of segments) {
    if (km >= segment.start_km && km <= segment.end_km) {
      return segment.color;
    }
  }
  return fallback;
}

function zoneHasDining(zone: ResupplyZone): boolean {
  return zone.categories.some((category) => category.key === "dining" && category.primary);
}

function zoneDetourBand(zone: ResupplyZone): DetourFilter {
  const minDetour = zoneMinDetourM(zone);
  if (minDetour < 20) return "on_route";
  if (minDetour < 75) return "very_small";
  if (minDetour < 150) return "small";
  if (minDetour < 300) return "medium";
  return "large";
}

export function zoneMarkerColor(
  zone: ResupplyZone,
  overlay: OverlayMode,
  timeMode: TimeMode,
  routeSegments: { start_km: number; end_km: number; color: string }[],
): string {
  if (timeMode === "night") {
    const hasNightFoodOrFuel = zone.categories.some((category) => {
      if (!category.primary || category.key === "water") {
        return false;
      }
      return (
        category.primary.night_usability === "usually_available" ||
        category.primary.night_usability === "depends_on_hours"
      );
    });
    if (hasNightFoodOrFuel) {
      return "#22c55e";
    }
    if (zone.categories.some((category) => category.key === "water" && category.primary)) {
      return "#3b82f6";
    }
    return "#9ca3af";
  }

  if (overlay === "resupply" || overlay === "surface") {
    return colorAtKm(zone.distance_along_km, routeSegments, NORMAL_ROUTE_COLOR);
  }

  return NORMAL_ROUTE_COLOR;
}

export function filterResupplyZones(
  zones: ResupplyZone[],
  filters: {
    categories: ResupplyCategoryFilter[];
    timeMode: TimeMode | "all";
    detourBands: DetourFilter[];
  },
): ResupplyZone[] {
  return zones.filter((zone) => {
    if (filters.timeMode === "night" && !zoneIsNightUseful(zone)) {
      return false;
    }

    if (filters.categories.length > 0) {
      const matchesCategory = filters.categories.some((category) => {
        if (category === "dining") {
          return zoneHasDining(zone);
        }
        return zone.categories.some(
          (group) => group.key === category && group.primary !== null,
        );
      });
      if (!matchesCategory) {
        return false;
      }
    }

    if (filters.detourBands.length > 0 && !filters.detourBands.includes(zoneDetourBand(zone))) {
      return false;
    }

    return true;
  });
}

export function sortResupplyZones(zones: ResupplyZone[], sortMode: ResupplySortMode): ResupplyZone[] {
  const sorted = [...zones];

  switch (sortMode) {
    case "along_route":
      return sorted.sort((left, right) => left.distance_along_km - right.distance_along_km);
    case "best_reliability":
      return sorted.sort(
        (left, right) =>
          computeUltraStopScore(right, null, "day").score -
          computeUltraStopScore(left, null, "day").score,
      );
    case "closest_to_route":
    case "least_detour":
      return sorted.sort((left, right) => zoneMinDetourM(left) - zoneMinDetourM(right));
    default:
      return sorted;
  }
}

export function timelineLabel(overlay: OverlayMode, timeMode: TimeMode): string {
  if (timeMode === "night") {
    return "Night resupply timeline";
  }
  if (overlay === "surface") {
    return "Surface timeline";
  }
  if (overlay === "resupply") {
    return "Resupply timeline";
  }
  return "Route timeline";
}
