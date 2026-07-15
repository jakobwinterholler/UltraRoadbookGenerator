import type { ResupplyZone, ZonePoiOption } from "../api";
import { planningScore } from "@shared/race/poiScoring";
import { poiReliabilityPresentation } from "./stopPresentation";

export interface RankedZonePoi {
  poi: ZonePoiOption;
  categoryLabel: string;
  categoryKey: string;
}

export interface StopRecommendationSummary {
  stopStars: number;
  stopStarDisplay: string;
  primary: RankedZonePoi | null;
  alternatives: RankedZonePoi[];
  /** @deprecated Use primary */
  best: RankedZonePoi | null;
  /** @deprecated Use alternatives (first two) */
  backups: RankedZonePoi[];
  /** @deprecated Use stopStars */
  hubStars: number;
  /** @deprecated Use stopStarDisplay */
  hubStarDisplay: string;
  excellentAlternativeCount: number;
  goodAlternativeCount: number;
  additionalStopCount: number;
  totalPois: number;
  allRanked: RankedZonePoi[];
}

function poiKey(poi: ZonePoiOption): string {
  return `${poi.osm_type}-${poi.osm_id}`;
}

function scoreZonePoi(poi: ZonePoiOption): number {
  return planningScore({
    priority: 1,
    category: poi.poi_category,
    distanceOffRouteM: poi.distance_off_route_m,
    score: poi.score,
    name: poi.name,
    brand: poi.brand,
    openingHours: poi.opening_hours,
  });
}

function flattenZonePois(zone: ResupplyZone): RankedZonePoi[] {
  const seen = new Set<string>();
  const items: RankedZonePoi[] = [];

  for (const group of zone.categories) {
    for (const option of [group.primary, ...group.alternatives]) {
      if (!option) {
        continue;
      }
      const key = poiKey(option);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        poi: option,
        categoryLabel: group.label,
        categoryKey: group.key,
      });
    }
  }

  return items.sort(
    (left, right) => scoreZonePoi(right.poi) - scoreZonePoi(left.poi),
  );
}

function tierBucket(score: number): "excellent" | "good" | "other" {
  if (score >= 68) {
    return "excellent";
  }
  if (score >= 52) {
    return "good";
  }
  return "other";
}

export function buildStopRecommendations(zone: ResupplyZone): StopRecommendationSummary {
  const allRanked = flattenZonePois(zone);
  const primary = allRanked[0] ?? null;
  const alternativeCandidates = allRanked.slice(1);
  const alternatives = alternativeCandidates.slice(0, 5);

  const recommendedKeys = new Set<string>(
    [primary, ...alternatives].filter(Boolean).map((item) => poiKey(item!.poi)),
  );

  let excellentAlternativeCount = 0;
  let goodAlternativeCount = 0;
  let additionalStopCount = 0;

  for (const item of allRanked) {
    if (recommendedKeys.has(poiKey(item.poi))) {
      continue;
    }
    const bucket = tierBucket(item.poi.score);
    if (bucket === "excellent") {
      excellentAlternativeCount += 1;
    } else if (bucket === "good") {
      goodAlternativeCount += 1;
    } else {
      additionalStopCount += 1;
    }
  }

  const stopReliability = allRanked.length > 0
    ? Math.max(...allRanked.map((item) => item.poi.score))
    : 0;
  const stopStars = poiReliabilityPresentation(stopReliability).stars;

  return {
    stopStars,
    stopStarDisplay: "★".repeat(stopStars) + "☆".repeat(Math.max(0, 5 - stopStars)),
    primary,
    alternatives,
    best: primary,
    backups: alternatives.slice(0, 2),
    hubStars: stopStars,
    hubStarDisplay: "★".repeat(stopStars) + "☆".repeat(Math.max(0, 5 - stopStars)),
    excellentAlternativeCount,
    goodAlternativeCount,
    additionalStopCount,
    totalPois: zone.poi_count,
    allRanked,
  };
}

/** @deprecated Use buildStopRecommendations */
export const buildHubRecommendations = buildStopRecommendations;

/** @deprecated Use StopRecommendationSummary */
export type HubRecommendationSummary = StopRecommendationSummary;

export function categoryEmoji(categoryKey: string): string {
  switch (categoryKey) {
    case "food":
      return "🛒";
    case "water":
      return "💧";
    case "fuel":
      return "⛽";
    case "dining":
      return "🍽";
    default:
      return "📍";
  }
}

export function formatStarRating(stars: number): string {
  const clamped = Math.max(0, Math.min(5, stars));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}
