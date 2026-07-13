import type { ResupplyZone, RouteVisualization } from "../../api";
import { zoneHasCategory } from "../../components/routeInsights";
import { elevationGainInKmRange } from "../resupplyGaps";
import { gravelPctInKmRange } from "../unsupportedSections";
import type { PrioritizedStop } from "./priority";
import type { VerifiedStopRecord } from "./types";
import { verifiedStopKey } from "./types";

export type GapAvailability = "good" | "possible" | "weak";

export interface VerifiedPlanStop {
  zoneId: number;
  name: string;
  km: number;
  lat: number;
  lon: number;
}

export interface VerifiedPlanGap {
  id: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationGainM: number;
  gravelPct: number;
  foodAvailability: GapAvailability;
  waterAvailability: GapAvailability;
  weaknessScore: number;
  fromStop: VerifiedPlanStop | null;
  toStop: VerifiedPlanStop | null;
}

export interface VerifiedPlan {
  stops: VerifiedPlanStop[];
  gaps: VerifiedPlanGap[];
  weakestGap: VerifiedPlanGap | null;
}

function isVerified(zoneId: number, verifiedStops: Record<string, VerifiedStopRecord>): boolean {
  return verifiedStops[verifiedStopKey(zoneId)]?.status === "verified";
}

function gapAvailability(
  hubs: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  startKm: number,
  endKm: number,
  category: "food" | "water",
): GapAvailability {
  const inRange = hubs.filter(
    (zone) => zone.distance_along_km >= startKm && zone.distance_along_km <= endKm,
  );
  const verifiedWithCategory = inRange.filter(
    (zone) => isVerified(zone.zone_id, verifiedStops) && zoneHasCategory(zone, category),
  );
  if (verifiedWithCategory.length > 0) {
    return "good";
  }
  if (inRange.some((zone) => zoneHasCategory(zone, category))) {
    return "possible";
  }
  return "weak";
}

function computeWeaknessScore(gap: {
  distanceKm: number;
  elevationGainM: number;
  gravelPct: number;
  foodAvailability: GapAvailability;
  waterAvailability: GapAvailability;
}): number {
  let score = gap.distanceKm * 3;
  score += gap.elevationGainM * 0.4;
  score += gap.gravelPct * 1.5;
  if (gap.foodAvailability === "weak") {
    score += 120;
  } else if (gap.foodAvailability === "possible") {
    score += 40;
  }
  if (gap.waterAvailability === "weak") {
    score += 90;
  } else if (gap.waterAvailability === "possible") {
    score += 30;
  }
  return Math.round(score);
}

function buildGap(
  id: string,
  fromStop: VerifiedPlanStop | null,
  toStop: VerifiedPlanStop | null,
  startKm: number,
  endKm: number,
  route: RouteVisualization,
  hubs: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): VerifiedPlanGap {
  const distanceKm = Math.max(0, endKm - startKm);
  const base = {
    id,
    startKm,
    endKm,
    distanceKm: Math.round(distanceKm),
    elevationGainM: elevationGainInKmRange(route.track_points, startKm, endKm),
    gravelPct: gravelPctInKmRange(route, startKm, endKm),
    foodAvailability: gapAvailability(hubs, verifiedStops, startKm, endKm, "food"),
    waterAvailability: gapAvailability(hubs, verifiedStops, startKm, endKm, "water"),
    fromStop,
    toStop,
  };
  return {
    ...base,
    weaknessScore: computeWeaknessScore(base),
  };
}

export function buildVerifiedPlan(
  route: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  routeViz: RouteVisualization,
  totalKm: number,
  planningHubs: ResupplyZone[],
): VerifiedPlan {
  const verified = route
    .filter((item) => isVerified(item.zone.zone_id, verifiedStops))
    .sort((left, right) => left.zone.distance_along_km - right.zone.distance_along_km)
    .map(
      (item): VerifiedPlanStop => ({
        zoneId: item.zone.zone_id,
        name: item.zone.name,
        km: Math.round(item.zone.distance_along_km),
        lat: item.zone.lat,
        lon: item.zone.lon,
      }),
    );

  const gaps: VerifiedPlanGap[] = [];

  if (verified.length === 0) {
    return { stops: [], gaps: [], weakestGap: null };
  }

  gaps.push(
    buildGap(
      "start",
      null,
      verified[0],
      0,
      verified[0].km,
      routeViz,
      planningHubs,
      verifiedStops,
    ),
  );

  for (let index = 0; index < verified.length - 1; index += 1) {
    const fromStop = verified[index];
    const toStop = verified[index + 1];
    gaps.push(
      buildGap(
        `${fromStop.zoneId}-${toStop.zoneId}`,
        fromStop,
        toStop,
        fromStop.km,
        toStop.km,
        routeViz,
        planningHubs,
        verifiedStops,
      ),
    );
  }

  const last = verified[verified.length - 1];
  gaps.push(
    buildGap(
      "finish",
      last,
      null,
      last.km,
      totalKm,
      routeViz,
      planningHubs,
      verifiedStops,
    ),
  );

  const weakestGap =
    gaps.length > 0
      ? gaps.reduce((weakest, gap) => (gap.weaknessScore > weakest.weaknessScore ? gap : weakest))
      : null;

  return { stops: verified, gaps, weakestGap };
}

export function gapContainingKm(gaps: VerifiedPlanGap[], km: number): VerifiedPlanGap | null {
  return (
    gaps.find((gap) => km > gap.startKm && km < gap.endKm) ??
    gaps.find((gap) => km >= gap.startKm && km <= gap.endKm) ??
    null
  );
}

export function gapAvailabilityLabel(level: GapAvailability): string {
  switch (level) {
    case "good":
      return "Verified";
    case "possible":
      return "Possible";
    case "weak":
      return "Weak";
  }
}

export function gapAvailabilityClass(level: GapAvailability): string {
  switch (level) {
    case "good":
      return "text-emerald-700";
    case "possible":
      return "text-amber-700";
    case "weak":
      return "text-red-700";
  }
}
