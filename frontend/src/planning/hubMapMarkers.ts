import type { ResupplyZone } from "../api";
import type { RouteContextMarker } from "../components/planning/RouteContextMiniMap";
import { formatPoiName } from "../components/poiUi";
import { buildHubRecommendations, type RankedZonePoi } from "./hubRecommendations";
import { poiIcon } from "./poiMapMarkers";
import type { StopSelection } from "./stopSelection";
import { poiVerificationStatus } from "./stopVerification/verificationStatusPresentation";
import type { VerifiedStopRecord } from "./stopVerification/types";

export const HUB_MAP_MARKER_LIMIT = 5;

function poiMatches(
  left: { osm_id: number; osm_type: string },
  right: { osm_id: number; osm_type: string } | null | undefined,
): boolean {
  if (!right) {
    return false;
  }
  return left.osm_type === right.osm_type && left.osm_id === right.osm_id;
}

function poiKey(poi: { osm_id: number; osm_type: string }): string {
  return `${poi.osm_type}-${poi.osm_id}`;
}

export function hubZoneForSelection(selection: Exclude<StopSelection, null>): ResupplyZone | null {
  if (selection.kind === "zone") {
    return selection.zone;
  }
  return selection.zone ?? null;
}

function rankedToMarker(
  { poi, categoryKey }: RankedZonePoi,
  zoneId: number,
  verifiedStops: Record<string, VerifiedStopRecord>,
  fallbackPoi: { osm_id: number; osm_type: string } | null,
  activePoi: { osm_id: number; osm_type: string } | null,
): RouteContextMarker {
  const status = poiVerificationStatus(zoneId, poi, verifiedStops, fallbackPoi);

  return {
    lat: poi.lat,
    lon: poi.lon,
    emoji: poiIcon(poi.poi_category) || "📍",
    label: formatPoiName(poi.name, poi.brand, {
      poiCategory: poi.poi_category,
      categoryKey,
    }),
    active: poiMatches(poi, activePoi),
    verified: status === "verified",
  };
}

function selectHubMapPois(
  ranked: RankedZonePoi[],
  zoneId: number,
  verifiedStops: Record<string, VerifiedStopRecord>,
  fallbackPoi: { osm_id: number; osm_type: string } | null,
  activePoi: { osm_id: number; osm_type: string } | null,
  limit: number,
): RankedZonePoi[] {
  if (ranked.length <= limit) {
    return ranked;
  }

  const picked = new Map<string, RankedZonePoi>();

  function pick(item: RankedZonePoi): void {
    if (picked.size >= limit) {
      return;
    }
    const key = poiKey(item.poi);
    if (!picked.has(key)) {
      picked.set(key, item);
    }
  }

  for (const item of ranked) {
    if (poiVerificationStatus(zoneId, item.poi, verifiedStops, fallbackPoi) === "verified") {
      pick(item);
    }
  }

  if (activePoi) {
    const active = ranked.find((item) => poiMatches(item.poi, activePoi));
    if (active) {
      pick(active);
    }
  }

  const categoriesUsed = new Set(Array.from(picked.values(), (item) => item.categoryKey));
  const unpicked = ranked.filter((item) => !picked.has(poiKey(item.poi)));

  const byCategory = new Map<string, RankedZonePoi>();
  for (const item of unpicked) {
    const existing = byCategory.get(item.categoryKey);
    if (!existing || item.poi.score > existing.poi.score) {
      byCategory.set(item.categoryKey, item);
    }
  }

  Array.from(byCategory.values())
    .sort((left, right) => right.poi.score - left.poi.score)
    .forEach((item) => {
      if (picked.size >= limit) {
        return;
      }
      if (!categoriesUsed.has(item.categoryKey)) {
        pick(item);
        categoriesUsed.add(item.categoryKey);
      }
    });

  for (const item of unpicked) {
    if (picked.size >= limit) {
      break;
    }
    pick(item);
  }

  const order = new Map(ranked.map((item, index) => [poiKey(item.poi), index]));
  return Array.from(picked.values()).sort(
    (left, right) => (order.get(poiKey(left.poi)) ?? 0) - (order.get(poiKey(right.poi)) ?? 0),
  );
}

export interface HubMapMarkersResult {
  markers: RouteContextMarker[];
  totalCount: number;
  hiddenCount: number;
}

export function buildHubMapMarkers(
  zone: ResupplyZone,
  options: {
    activePoi?: { osm_id: number; osm_type: string } | null;
    verifiedStops?: Record<string, VerifiedStopRecord>;
    showAll?: boolean;
    limit?: number;
  } = {},
): HubMapMarkersResult {
  const {
    activePoi = null,
    verifiedStops = {},
    showAll = false,
    limit = HUB_MAP_MARKER_LIMIT,
  } = options;

  const summary = buildHubRecommendations(zone);
  const ranked = summary.allRanked;
  const fallbackPoi = summary.best?.poi ?? null;
  const selected = showAll
    ? ranked
    : selectHubMapPois(ranked, zone.zone_id, verifiedStops, fallbackPoi, activePoi, limit);

  return {
    markers: selected.map((item) =>
      rankedToMarker(item, zone.zone_id, verifiedStops, fallbackPoi, activePoi),
    ),
    totalCount: ranked.length,
    hiddenCount: Math.max(0, ranked.length - selected.length),
  };
}
