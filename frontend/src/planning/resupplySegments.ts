import type { ResupplyZone, RouteVisualization } from "../api";
import { zoneHasCategory } from "../components/routeInsights";
import { elevationGainInKmRange } from "./resupplyGaps";
import type { VerifiedStopRecord } from "./stopVerification/types";
import { verifiedStopKey } from "./stopVerification/types";
import {
  gapAvailabilityClass,
  gapAvailabilityLabel,
  type GapAvailability,
} from "./stopVerification/verifiedPlan";
import { elevationLossInKmRange, gravelPctInKmRange } from "./unsupportedSections";
import type { KmRangeSelection } from "./useRouteWorkspaceSelection";

export interface ResupplySegmentRange {
  startKm: number;
  endKm: number;
  label: string;
  endZoneId: number;
  endZoneName: string;
  startZoneName: string | null;
}

export interface SurfaceMixRow {
  category: string;
  percentage: number;
}

export interface ResupplySegmentSummary {
  range: ResupplySegmentRange;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  gravelPct: number;
  surfaceMix: SurfaceMixRow[];
  verifiedStopsInside: Array<{ zoneId: number; name: string; km: number }>;
  foodAvailability: GapAvailability;
  waterAvailability: GapAvailability;
}

function sortedByKm(zones: ResupplyZone[]): ResupplyZone[] {
  return [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
}

function verifiedZones(
  zones: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): ResupplyZone[] {
  return sortedByKm(zones).filter(
    (zone) => verifiedStops[verifiedStopKey(zone.zone_id)]?.status === "verified",
  );
}

export function resupplySegmentEndingAtZone(
  zone: ResupplyZone,
  sortedZones: ResupplyZone[],
): ResupplySegmentRange {
  const index = sortedZones.findIndex((item) => item.zone_id === zone.zone_id);
  const startKm = index > 0 ? sortedZones[index - 1].distance_along_km : 0;
  const startZoneName = index > 0 ? sortedZones[index - 1].name : null;

  return {
    startKm,
    endKm: zone.distance_along_km,
    label: startZoneName ? `${startZoneName} → ${zone.name}` : `Start → ${zone.name}`,
    endZoneId: zone.zone_id,
    endZoneName: zone.name,
    startZoneName,
  };
}

export function resolveResupplySegmentEndingAtZone(
  zone: ResupplyZone,
  planningZones: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): ResupplySegmentRange {
  const verified = verifiedZones(planningZones, verifiedStops);
  const verifiedIndex = verified.findIndex((item) => item.zone_id === zone.zone_id);

  if (verifiedIndex >= 0) {
    const startKm = verifiedIndex > 0 ? verified[verifiedIndex - 1].distance_along_km : 0;
    const startZoneName = verifiedIndex > 0 ? verified[verifiedIndex - 1].name : null;
    return {
      startKm,
      endKm: zone.distance_along_km,
      label: startZoneName
        ? `Verified · ${startZoneName} → ${zone.name}`
        : `Verified · Start → ${zone.name}`,
      endZoneId: zone.zone_id,
      endZoneName: zone.name,
      startZoneName,
    };
  }

  return resupplySegmentEndingAtZone(zone, sortedByKm(planningZones));
}

export function kmRangeFromSegment(segment: ResupplySegmentRange): KmRangeSelection {
  return {
    startKm: segment.startKm,
    endKm: segment.endKm,
    label: segment.label,
  };
}

function gapAvailabilityInRange(
  hubs: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  startKm: number,
  endKm: number,
  category: "food" | "water",
): GapAvailability {
  const inRange = hubs.filter(
    (zone) => zone.distance_along_km > startKm && zone.distance_along_km < endKm,
  );
  const verifiedWithCategory = inRange.filter(
    (zone) =>
      verifiedStops[verifiedStopKey(zone.zone_id)]?.status === "verified" &&
      zoneHasCategory(zone, category),
  );
  if (verifiedWithCategory.length > 0) {
    return "good";
  }
  if (inRange.some((zone) => zoneHasCategory(zone, category))) {
    return "possible";
  }
  return "weak";
}

export function surfaceMixInKmRange(
  route: RouteVisualization,
  startKm: number,
  endKm: number,
): SurfaceMixRow[] {
  const distanceKm = Math.max(endKm - startKm, 0.001);
  const totals = new Map<string, number>();

  for (const segment of route.surface_segments) {
    if (segment.end_km <= startKm || segment.start_km >= endKm) {
      continue;
    }
    const overlapStart = Math.max(segment.start_km, startKm);
    const overlapEnd = Math.min(segment.end_km, endKm);
    const overlapKm = Math.max(0, overlapEnd - overlapStart);
    const key = segment.rider_category ?? segment.surface;
    totals.set(key, (totals.get(key) ?? 0) + overlapKm);
  }

  return [...totals.entries()]
    .map(([category, km]) => ({
      category,
      percentage: Math.round((km / distanceKm) * 100),
    }))
    .filter((row) => row.percentage > 0)
    .sort((left, right) => right.percentage - left.percentage);
}

export function buildResupplySegmentSummary(
  segment: ResupplySegmentRange,
  route: RouteVisualization,
  hubs: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): ResupplySegmentSummary {
  const { startKm, endKm } = segment;
  const verifiedStopsInside = sortedByKm(hubs)
    .filter(
      (zone) =>
        zone.distance_along_km > startKm &&
        zone.distance_along_km < endKm &&
        verifiedStops[verifiedStopKey(zone.zone_id)]?.status === "verified",
    )
    .map((zone) => ({
      zoneId: zone.zone_id,
      name: zone.name,
      km: Math.round(zone.distance_along_km),
    }));

  return {
    range: segment,
    distanceKm: Math.round(endKm - startKm),
    elevationGainM: elevationGainInKmRange(route.track_points, startKm, endKm),
    elevationLossM: elevationLossInKmRange(route.track_points, startKm, endKm),
    gravelPct: gravelPctInKmRange(route, startKm, endKm),
    surfaceMix: surfaceMixInKmRange(route, startKm, endKm),
    verifiedStopsInside,
    foodAvailability: gapAvailabilityInRange(hubs, verifiedStops, startKm, endKm, "food"),
    waterAvailability: gapAvailabilityInRange(hubs, verifiedStops, startKm, endKm, "water"),
  };
}

export function resupplySegmentBands(
  sortedZones: ResupplyZone[],
): Array<{ startKm: number; endKm: number; endZoneId: number }> {
  const bands: Array<{ startKm: number; endKm: number; endZoneId: number }> = [];
  for (let index = 0; index < sortedZones.length; index += 1) {
    const zone = sortedZones[index];
    const startKm = index > 0 ? sortedZones[index - 1].distance_along_km : 0;
    bands.push({ startKm, endKm: zone.distance_along_km, endZoneId: zone.zone_id });
  }
  return bands;
}

export { gapAvailabilityClass, gapAvailabilityLabel };
