import type { ResupplyZone, RouteVisualization, TrackPoint } from "../api";

export interface ZoneGap {
  fromZoneId: number;
  toZoneId: number;
  gapKm: number;
  startKm: number;
  endKm: number;
}

export interface RouteInsights {
  longestGapKm: number;
  longestGap: ZoneGap | null;
  zoneGaps: ZoneGap[];
  resupplyMix: Record<string, number>;
  surfaceMix: Record<string, number>;
}

export function computeZoneGaps(zones: ResupplyZone[]): ZoneGap[] {
  const sorted = [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
  const gaps: ZoneGap[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    gaps.push({
      fromZoneId: current.zone_id,
      toZoneId: next.zone_id,
      gapKm: next.distance_along_km - current.distance_along_km,
      startKm: current.distance_along_km,
      endKm: next.distance_along_km,
    });
  }

  return gaps;
}

export function computeRouteInsights(
  zones: ResupplyZone[],
  route: RouteVisualization,
  _totalKm: number,
): RouteInsights {
  const zoneGaps = computeZoneGaps(zones);
  const longestGap =
    zoneGaps.length > 0
      ? zoneGaps.reduce((best, gap) => (gap.gapKm > best.gapKm ? gap : best))
      : null;

  const resupplyMix: Record<string, number> = {};
  for (const segment of route.resupply_segments) {
    const span = Math.max(segment.end_km - segment.start_km, 0);
    resupplyMix[segment.quality] = (resupplyMix[segment.quality] ?? 0) + span;
  }

  const surfaceMix: Record<string, number> = {};
  for (const segment of route.surface_segments) {
    const span = Math.max(segment.end_km - segment.start_km, 0);
    surfaceMix[segment.surface] = (surfaceMix[segment.surface] ?? 0) + span;
  }

  return {
    longestGapKm: longestGap?.gapKm ?? 0,
    longestGap,
    zoneGaps,
    resupplyMix,
    surfaceMix,
  };
}

export function zoneHasCategory(zone: ResupplyZone, key: "food" | "water" | "fuel"): boolean {
  return zone.categories.some((category) => category.key === key && category.primary !== null);
}

export function zonePrimaryName(zone: ResupplyZone, key: "food" | "water" | "fuel"): string | null {
  const category = zone.categories.find((item) => item.key === key);
  if (!category?.primary) {
    return null;
  }
  return category.primary.name ?? category.primary.brand ?? null;
}

export function formatKm(km: number, digits = 0): string {
  return `${km.toFixed(digits)} km`;
}

export function percentOfRoute(kmSpan: number, totalKm: number): number {
  if (totalKm <= 0) {
    return 0;
  }
  return Math.round((kmSpan / totalKm) * 100);
}

export function activePoint(points: TrackPoint[], activeIndex: number | null): TrackPoint | null {
  if (activeIndex === null || activeIndex < 0 || activeIndex >= points.length) {
    return null;
  }
  return points[activeIndex];
}

export function nearestZoneAtKm(zones: ResupplyZone[], km: number): ResupplyZone | null {
  if (zones.length === 0) {
    return null;
  }

  let best = zones[0];
  let bestDistance = Math.abs(zones[0].distance_along_km - km);

  for (const zone of zones) {
    const distance = Math.abs(zone.distance_along_km - km);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zone;
    }
  }

  return bestDistance <= 5 ? best : null;
}
