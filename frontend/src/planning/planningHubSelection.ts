import type { ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { zoneMinDetourM, zoneScore } from "./zonePresentation";

const URBAN_CLUSTER_KM = 2;
const URBAN_MIN_ZONES = 3;
const BASE_SPACING_KM = 16;
const TIGHT_SPACING_KM = 10;
const REMOTE_GAP_KM = 22;
const REMOTE_PICK_SPACING_KM = 6;
const LOOKAHEAD_KM = 20;

export interface PlanningHubBenchmark {
  walkSteps: number;
  spacingCalculations: number;
  elevationCalculations: number;
  gravelCalculations: number;
}

function compareHubCandidates(left: ResupplyZone, right: ResupplyZone): number {
  const detourDiff = zoneMinDetourM(left) - zoneMinDetourM(right);
  if (detourDiff !== 0) {
    return detourDiff;
  }
  return zoneScore(right) - zoneScore(left);
}

function pickBestInRange(candidates: ResupplyZone[], startIndex: number, endIndex: number): number {
  let bestIndex = startIndex;
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    if (compareHubCandidates(candidates[index], candidates[bestIndex]) < 0) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

function collapseUrbanClusters(zones: ResupplyZone[]): ResupplyZone[] {
  const sorted = [...zones].sort(
    (left, right) => left.distance_along_km - right.distance_along_km,
  );
  if (sorted.length === 0) {
    return sorted;
  }

  const collapsed: ResupplyZone[] = [];
  let cluster: ResupplyZone[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const zone = sorted[index];
    const clusterStart = cluster[0].distance_along_km;
    if (zone.distance_along_km - clusterStart <= URBAN_CLUSTER_KM) {
      cluster.push(zone);
      continue;
    }

    if (cluster.length >= URBAN_MIN_ZONES) {
      collapsed.push(cluster[pickBestInRange(cluster, 0, cluster.length - 1)]);
    } else {
      collapsed.push(...cluster);
    }
    cluster = [zone];
  }

  if (cluster.length >= URBAN_MIN_ZONES) {
    collapsed.push(cluster[pickBestInRange(cluster, 0, cluster.length - 1)]);
  } else {
    collapsed.push(...cluster);
  }
  return collapsed;
}

function lowerBoundKm(points: TrackPoint[], km: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].km < km) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/** Precomputed route metrics — built once, queried in O(log n) or O(1). */
class RouteMetricsCache {
  private readonly gravelPrefix: Float64Array;

  constructor(
    private readonly trackPoints: TrackPoint[],
    route: RouteVisualization,
    totalKm: number,
    private readonly benchmark: PlanningHubBenchmark | undefined,
  ) {
    const bucketCount = Math.max(1, Math.ceil(totalKm) + 1);
    this.gravelPrefix = new Float64Array(bucketCount);
    let running = 0;
    for (let km = 0; km < bucketCount; km += 1) {
      running += gravelKmInSlice(route, km, km + 1);
      this.gravelPrefix[km] = running;
    }
  }

  elevationGainM(startKm: number, endKm: number): number {
    if (this.benchmark) {
      this.benchmark.elevationCalculations += 1;
    }
    if (this.trackPoints.length < 2 || endKm <= startKm) {
      return 0;
    }
    const startIndex = lowerBoundKm(this.trackPoints, startKm);
    const endIndex = lowerBoundKm(this.trackPoints, endKm);
    if (endIndex <= startIndex) {
      return 0;
    }
    const startGain = this.trackPoints[startIndex].cumulative_gain_m;
    const endGain = this.trackPoints[endIndex].cumulative_gain_m;
    return Math.max(0, Math.round(endGain - startGain));
  }

  gravelPct(startKm: number, endKm: number): number {
    if (this.benchmark) {
      this.benchmark.gravelCalculations += 1;
    }
    const distanceKm = endKm - startKm;
    if (distanceKm <= 0) {
      return 0;
    }
    const startBucket = Math.min(Math.max(0, Math.floor(startKm)), this.gravelPrefix.length - 1);
    const endBucket = Math.min(Math.max(0, Math.ceil(endKm)), this.gravelPrefix.length - 1);
    const gravelKm = this.gravelPrefix[endBucket] - this.gravelPrefix[startBucket];
    return Math.round((gravelKm / distanceKm) * 100);
  }

  targetSpacingKm(anchorKm: number, totalKm: number, gapToNextKm: number): number {
    if (this.benchmark) {
      this.benchmark.spacingCalculations += 1;
    }
    if (gapToNextKm >= REMOTE_GAP_KM) {
      return REMOTE_PICK_SPACING_KM;
    }
    const lookaheadEnd = Math.min(anchorKm + LOOKAHEAD_KM, totalKm);
    const gravelPct = this.gravelPct(anchorKm, lookaheadEnd);
    const gainM = this.elevationGainM(anchorKm, lookaheadEnd);
    if (gravelPct >= 25 || gainM >= 400) {
      return TIGHT_SPACING_KM;
    }
    if (gravelPct >= 15 || gainM >= 250) {
      return 12;
    }
    return BASE_SPACING_KM;
  }
}

function gravelKmInSlice(
  route: RouteVisualization,
  startKm: number,
  endKm: number,
): number {
  let gravelKm = 0;
  for (const segment of route.surface_segments ?? []) {
    if (segment.end_km <= startKm || segment.start_km >= endKm) {
      continue;
    }
    const category = segment.rider_category ?? segment.surface;
    if (category !== "Gravel") {
      continue;
    }
    const overlapStart = Math.max(segment.start_km, startKm);
    const overlapEnd = Math.min(segment.end_km, endKm);
    gravelKm += Math.max(0, overlapEnd - overlapStart);
  }
  return gravelKm;
}

/**
 * Pick representative planning hubs in a single O(n) pass over collapsed candidates.
 * Route metrics (gravel prefix, elevation lookup) are precomputed once.
 */
export function selectPlanningHubs(
  zones: ResupplyZone[],
  route: RouteVisualization,
  totalKm: number,
  benchmark?: PlanningHubBenchmark,
): ResupplyZone[] {
  if (zones.length === 0) {
    return [];
  }

  const candidates = collapseUrbanClusters(zones);
  if (candidates.length === 1) {
    return candidates;
  }

  const metrics = new RouteMetricsCache(route.track_points, route, totalKm, benchmark);
  const picked: ResupplyZone[] = [];
  const pickedIds = new Set<number>();

  function pickAt(index: number): void {
    const zone = candidates[index];
    if (pickedIds.has(zone.zone_id)) {
      return;
    }
    pickedIds.add(zone.zone_id);
    picked.push(zone);
    if (benchmark) {
      benchmark.walkSteps += 1;
    }
  }

  pickAt(0);
  let anchorIndex = 0;

  while (anchorIndex < candidates.length - 1) {
    const anchorKm = candidates[anchorIndex].distance_along_km;
    const gapToNext = candidates[anchorIndex + 1].distance_along_km - anchorKm;
    const spacing = metrics.targetSpacingKm(anchorKm, totalKm, gapToNext);

    if (gapToNext >= REMOTE_GAP_KM) {
      let scanIndex = anchorIndex + 1;
      let lastPickedIndex = anchorIndex;
      const windowEnd = anchorKm + spacing * 2.5;

      while (scanIndex < candidates.length && candidates[scanIndex].distance_along_km <= windowEnd) {
        const zone = candidates[scanIndex];
        const sinceLastPick =
          zone.distance_along_km - candidates[lastPickedIndex].distance_along_km;
        if (sinceLastPick >= spacing * 0.75) {
          pickAt(scanIndex);
          lastPickedIndex = scanIndex;
        }
        scanIndex += 1;
      }

      if (lastPickedIndex === anchorIndex) {
        pickAt(anchorIndex + 1);
        anchorIndex = anchorIndex + 1;
      } else {
        anchorIndex = lastPickedIndex;
      }
      continue;
    }

    const targetKm = anchorKm + spacing;
    let targetIndex = anchorIndex + 1;
    while (targetIndex < candidates.length && candidates[targetIndex].distance_along_km < targetKm) {
      targetIndex += 1;
    }

    if (targetIndex >= candidates.length) {
      break;
    }

    let clusterStart = targetIndex;
    while (
      clusterStart > anchorIndex + 1 &&
      candidates[targetIndex].distance_along_km - candidates[clusterStart - 1].distance_along_km <=
        URBAN_CLUSTER_KM
    ) {
      clusterStart -= 1;
    }

    const bestIndex = pickBestInRange(candidates, clusterStart, targetIndex);
    pickAt(bestIndex);
    anchorIndex = bestIndex;
  }

  pickAt(candidates.length - 1);
  return picked;
}

/** POI-centric alias — replaces hub terminology. */
export const selectPlanningStops = selectPlanningHubs;
