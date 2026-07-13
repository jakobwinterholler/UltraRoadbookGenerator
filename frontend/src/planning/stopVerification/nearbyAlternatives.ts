import type { ResupplyZone } from "../../api";
import { buildHubRecommendations } from "../hubRecommendations";
import { computeUltraStopScore } from "../stopPresentation";
import type { TimeMode } from "../types";
import type { TimeWindowId } from "../timeWindows";
import { formatPoiName } from "../../components/poiUi";
import type { PrioritizedStop } from "./priority";
import { isStopPending } from "./priority";
import type { VerifiedStopRecord } from "./types";

/** Stops within this gap share a planning area for local alternatives. */
export const PLANNING_AREA_KM = 12;

const MAX_NEARBY_ALTERNATIVES = 3;

export interface NearbyAlternativeStop {
  stop: PrioritizedStop;
  positionLabel: string;
  displayName: string;
}

function prioritizedStopForZone(
  zone: ResupplyZone,
  fullRoute: PrioritizedStop[],
): PrioritizedStop {
  const existing = fullRoute.find((item) => item.zone.zone_id === zone.zone_id);
  if (existing) {
    return existing;
  }
  return {
    zone,
    tier: 5,
    tierScore: 0,
    context: {
      isLastBeforeRemote: false,
      isOnlyStopInArea: false,
      isBorderline: false,
    },
  };
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

function alternativeDisplayName(zone: ResupplyZone): string {
  const best = buildHubRecommendations(zone).best;
  if (best) {
    return formatPoiName(best.poi.name, best.poi.brand, {
      poiCategory: best.poi.poi_category,
      categoryKey: best.categoryKey,
    });
  }
  return zone.name;
}

export function findNearbyAlternativeStops(
  anchor: PrioritizedStop,
  allZones: ResupplyZone[],
  fullRoute: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): NearbyAlternativeStop[] {
  const anchorKm = anchor.zone.distance_along_km;
  const anchorZoneId = anchor.zone.zone_id;

  const candidates = allZones
    .filter(
      (zone) =>
        zone.zone_id !== anchorZoneId &&
        Math.abs(zone.distance_along_km - anchorKm) <= PLANNING_AREA_KM &&
        isStopPending(zone.zone_id, verifiedStops),
    )
    .map((zone) => {
      const stop = prioritizedStopForZone(zone, fullRoute);
      const ultra = computeUltraStopScore(zone, timeWindowId, timeMode);
      return {
        zone,
        stop,
        score: stop.tierScore > 0 ? stop.tierScore : ultra.score,
        distanceFromAnchor: Math.abs(zone.distance_along_km - anchorKm),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.distanceFromAnchor - right.distanceFromAnchor;
    })
    .slice(0, MAX_NEARBY_ALTERNATIVES);

  return candidates.map(({ zone, stop }) => ({
    stop,
    positionLabel: relativePositionLabel(anchorKm, zone.distance_along_km),
    displayName: alternativeDisplayName(zone),
  }));
}

export function hasNearbyAlternatives(
  anchor: PrioritizedStop,
  allZones: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): boolean {
  const anchorKm = anchor.zone.distance_along_km;
  return allZones.some(
    (zone) =>
      zone.zone_id !== anchor.zone.zone_id &&
      Math.abs(zone.distance_along_km - anchorKm) <= PLANNING_AREA_KM &&
      isStopPending(zone.zone_id, verifiedStops),
  );
}
