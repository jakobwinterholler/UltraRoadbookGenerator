import type { ResupplyZone, ZonePoiOption } from "../api";
import { poiReliabilityPresentation } from "./stopPresentation";

export interface RankedZonePoi {
  poi: ZonePoiOption;
  categoryLabel: string;
  categoryKey: string;
}

export interface HubRecommendationSummary {
  hubStars: number;
  hubStarDisplay: string;
  best: RankedZonePoi | null;
  backups: RankedZonePoi[];
  excellentAlternativeCount: number;
  goodAlternativeCount: number;
  additionalStopCount: number;
  totalPois: number;
  allRanked: RankedZonePoi[];
}

function poiKey(poi: ZonePoiOption): string {
  return `${poi.osm_type}-${poi.osm_id}`;
}

function planningScore(poi: ZonePoiOption): number {
  const detourPenalty = Math.min(poi.distance_off_route_m / 8, 35);
  return poi.score - detourPenalty;
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
    (left, right) => planningScore(right.poi) - planningScore(left.poi),
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

export function buildHubRecommendations(zone: ResupplyZone): HubRecommendationSummary {
  const allRanked = flattenZonePois(zone);
  const best = allRanked[0] ?? null;
  const backupCandidates = allRanked.slice(1);
  const backups = backupCandidates.slice(0, 2);

  const recommendedKeys = new Set<string>(
    [best, ...backups].filter(Boolean).map((item) => poiKey(item!.poi)),
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

  const hubReliability = allRanked.length > 0
    ? Math.max(...allRanked.map((item) => item.poi.score))
    : 0;
  const hubStars = poiReliabilityPresentation(hubReliability).stars;

  return {
    hubStars,
    hubStarDisplay: "★".repeat(hubStars) + "☆".repeat(Math.max(0, 5 - hubStars)),
    best,
    backups,
    excellentAlternativeCount,
    goodAlternativeCount,
    additionalStopCount,
    totalPois: zone.poi_count,
    allRanked,
  };
}

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
