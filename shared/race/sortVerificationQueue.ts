import { haversineM } from "./mapMatching";
import { computeStopConfidence } from "./stopConfidence";
import type { CompanionStop } from "../types/sync";

export const VERIFICATION_PROXIMITY_MAX_M = 40;

export interface SortVerificationOptions {
  lat: number | null;
  lon: number | null;
  currentKm: number;
}

function stopDistanceM(
  stop: CompanionStop,
  lat: number | null,
  lon: number | null,
): number | null {
  if (lat == null || lon == null) {
    return null;
  }
  return haversineM(lat, lon, stop.lat, stop.lon);
}

export function isNearbyVerificationStop(
  stop: CompanionStop,
  lat: number | null,
  lon: number | null,
): boolean {
  const distance = stopDistanceM(stop, lat, lon);
  return distance != null && distance <= VERIFICATION_PROXIMITY_MAX_M;
}

export function countNearbyVerificationStops(
  stops: CompanionStop[],
  lat: number | null,
  lon: number | null,
): number {
  return stops.filter((stop) => isNearbyVerificationStop(stop, lat, lon)).length;
}

function reviewPriority(status: CompanionStop["verificationStatus"]): number {
  if (status === "needs_review") {
    return 0;
  }
  if (status === "unverified") {
    return 1;
  }
  return 2;
}

function confidenceScore(stop: CompanionStop): number {
  return computeStopConfidence({
    verificationStatus: stop.verificationStatus,
    verifiedAt: stop.verificationDate,
    poiScore: stop.confidenceScore,
    openingHours: stop.openingHours,
    website: stop.website,
    phone: stop.phone,
  }).score;
}

/** Sort stops for companion verification swipe queue. */
export function sortVerificationQueue(
  stops: CompanionStop[],
  options: SortVerificationOptions,
): CompanionStop[] {
  const { lat, lon, currentKm } = options;

  return [...stops].sort((left, right) => {
    const leftNearby = isNearbyVerificationStop(left, lat, lon);
    const rightNearby = isNearbyVerificationStop(right, lat, lon);
    if (leftNearby !== rightNearby) {
      return leftNearby ? -1 : 1;
    }

    const leftRoute = Math.abs(left.km - currentKm);
    const rightRoute = Math.abs(right.km - currentKm);
    if (leftRoute !== rightRoute) {
      return leftRoute - rightRoute;
    }
    if (left.km !== right.km) {
      return left.km - right.km;
    }

    const leftReview = reviewPriority(left.verificationStatus);
    const rightReview = reviewPriority(right.verificationStatus);
    if (leftReview !== rightReview) {
      return leftReview - rightReview;
    }

    return confidenceScore(left) - confidenceScore(right);
  });
}

export function formatStopDistanceM(distanceM: number | null): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return null;
  }
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m away`;
  }
  return `${(distanceM / 1000).toFixed(1)} km away`;
}
