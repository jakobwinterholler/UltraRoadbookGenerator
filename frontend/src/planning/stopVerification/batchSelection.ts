import type { RouteVisualization } from "../../api";
import {
  buildVerifiedPlan,
  gapContainingKm,
  type VerifiedPlanGap,
} from "./verifiedPlan";
import {
  buildVerificationRoute,
  isStopPending,
  type PrioritizedStop,
} from "./priority";
import type { ResupplyZone } from "../../api";
import type { TimeMode } from "../types";
import type { TimeWindowId } from "../timeWindows";
import type { VerifiedStopRecord } from "./types";
import { verifiedStopKey } from "./types";

export const VERIFICATION_BATCH_SIZE = 16;

const NEAR_VERIFIED_PENALTY_KM = 12;
const VERY_NEAR_VERIFIED_PENALTY_KM = 5;

function nearestVerifiedKm(
  km: number,
  route: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): number | null {
  let nearest: number | null = null;
  for (const item of route) {
    if (verifiedStops[verifiedStopKey(item.zone.zone_id)]?.status !== "verified") {
      continue;
    }
    const delta = Math.abs(item.zone.distance_along_km - km);
    if (nearest === null || delta < nearest) {
      nearest = delta;
    }
  }
  return nearest;
}

function scoreCandidate(
  stop: PrioritizedStop,
  route: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  gaps: VerifiedPlanGap[],
  verifiedCount: number,
): number {
  let score = stop.tierScore;
  const km = stop.zone.distance_along_km;

  const gap = gapContainingKm(gaps, km);
  if (gap) {
    score += gap.weaknessScore * 1.8;
    if (gap.foodAvailability === "weak") {
      score += 80;
    }
    if (gap.waterAvailability === "weak") {
      score += 60;
    }
  }

  const nearestVerified = nearestVerifiedKm(km, route, verifiedStops);
  if (nearestVerified !== null) {
    if (nearestVerified < VERY_NEAR_VERIFIED_PENALTY_KM) {
      score -= 900;
    } else if (nearestVerified < NEAR_VERIFIED_PENALTY_KM) {
      score -= 450;
    }
  }

  if (verifiedCount === 0) {
    score += stop.tier <= 2 ? 200 : 0;
  }

  if (stop.context.isLastBeforeRemote) {
    score += 150;
  }
  if (stop.context.isOnlyStopInArea) {
    score += 100;
  }

  return score;
}

export function selectNextBatch(
  planningHubs: ResupplyZone[],
  routeViz: RouteVisualization,
  totalKm: number,
  verifiedStops: Record<string, VerifiedStopRecord>,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
  batchSize = VERIFICATION_BATCH_SIZE,
): PrioritizedStop[] {
  const fullRoute = buildVerificationRoute(
    planningHubs,
    routeViz,
    totalKm,
    timeWindowId,
    timeMode,
  );

  const candidates = fullRoute.filter((item) =>
    isStopPending(item.zone.zone_id, verifiedStops),
  );

  if (candidates.length === 0) {
    return [];
  }

  const verifiedCount = fullRoute.filter(
    (item) => verifiedStops[verifiedStopKey(item.zone.zone_id)]?.status === "verified",
  ).length;

  const plan = buildVerifiedPlan(
    fullRoute,
    verifiedStops,
    routeViz,
    totalKm,
    planningHubs,
  );

  const scored = candidates
    .map((stop) => ({
      stop,
      score: scoreCandidate(stop, fullRoute, verifiedStops, plan.gaps, verifiedCount),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.stop.zone.distance_along_km - right.stop.zone.distance_along_km;
    });

  return scored.slice(0, batchSize).map((entry) => entry.stop).sort(
    (left, right) => left.zone.distance_along_km - right.zone.distance_along_km,
  );
}

export function batchIsComplete(
  batch: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): boolean {
  return batch.every((item) => !isStopPending(item.zone.zone_id, verifiedStops));
}

export function countBatchPending(
  batch: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): number {
  return batch.filter((item) => isStopPending(item.zone.zone_id, verifiedStops)).length;
}

export function firstPendingInList(
  batch: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): number {
  return batch.findIndex((item) => isStopPending(item.zone.zone_id, verifiedStops));
}

export function nextPendingInList(
  batch: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  afterIndex: number,
): number {
  for (let index = afterIndex + 1; index < batch.length; index += 1) {
    if (isStopPending(batch[index].zone.zone_id, verifiedStops)) {
      return index;
    }
  }
  for (let index = 0; index <= afterIndex; index += 1) {
    if (isStopPending(batch[index].zone.zone_id, verifiedStops)) {
      return index;
    }
  }
  return -1;
}

export function remainingCandidateCount(
  planningHubs: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): number {
  return planningHubs.filter((zone) => isStopPending(zone.zone_id, verifiedStops)).length;
}
