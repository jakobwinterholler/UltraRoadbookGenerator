import type { ResupplyZone, RoadbookResult, RouteVisualization } from "../api";
import { formatPoiName } from "../components/poiUi";
import { poiIcon } from "../planning/poiMapMarkers";
import { analyzeUnsupportedSections } from "../planning/unsupportedSections";
import type { VerifiedStopRecord } from "../planning/stopVerification/types";
import { verifiedStopKey } from "../planning/stopVerification/types";

export const COMPANION_SCHEMA_VERSION = 1;

export interface CompanionStop {
  zoneId: number;
  km: number;
  lat: number;
  lon: number;
  name: string;
  category: string;
  categoryLabel: string;
  icon: string;
  verificationStatus: "verified" | "unverified";
  openingHours: string | null;
  notes: string | null;
}

export interface CompanionUnsupportedSection {
  id: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  displayLabel: string;
  riskLevel: string;
}

export interface CompanionBundle {
  schemaVersion: number;
  exportedAt: string;
  race: {
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number;
  };
  route: {
    coordinates: [number, number][];
    bounds: {
      south: number;
      west: number;
      north: number;
      east: number;
    };
  };
  stops: CompanionStop[];
  unsupportedSections: CompanionUnsupportedSection[];
}

function primaryPoi(zone: ResupplyZone) {
  const water = zone.categories.find((group) => group.key === "water")?.primary;
  const food = zone.categories.find((group) => group.key === "food")?.primary;
  const fuel = zone.categories.find((group) => group.key === "fuel")?.primary;
  return (
    water ??
    food ??
    fuel ??
    zone.categories.find((group) => group.primary)?.primary ??
    null
  );
}

function categoryLabelForZone(zone: ResupplyZone): string {
  const labels = zone.categories
    .filter((group) => group.primary)
    .map((group) => group.label);
  return labels.length > 0 ? labels.join(" · ") : "Resupply";
}

function buildBounds(route: RouteVisualization): CompanionBundle["route"]["bounds"] {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const point of route.track_points) {
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
  }
  const latPad = Math.max(0.01, (north - south) * 0.08);
  const lonPad = Math.max(0.01, (east - west) * 0.08);
  return {
    south: south - latPad,
    north: north + latPad,
    west: west - lonPad,
    east: east + lonPad,
  };
}

function buildStop(
  zone: ResupplyZone,
  verifiedStops: Record<string, VerifiedStopRecord>,
): CompanionStop {
  const poi = primaryPoi(zone);
  const record = verifiedStops[verifiedStopKey(zone.zone_id)];
  const verified = record?.status === "verified";
  const category = poi?.poi_category ?? "Resupply";

  return {
    zoneId: zone.zone_id,
    km: zone.distance_along_km,
    lat: zone.lat,
    lon: zone.lon,
    name: poi
      ? formatPoiName(poi.name, poi.brand, {
          poiCategory: poi.poi_category,
          categoryKey: zone.categories.find((group) => group.primary === poi)?.key,
        })
      : zone.name,
    category,
    categoryLabel: categoryLabelForZone(zone),
    icon: poi ? poiIcon(category) : "📍",
    verificationStatus: verified ? "verified" : "unverified",
    openingHours: poi?.opening_hours ?? null,
    notes: record?.rejectNotes?.trim() || null,
  };
}

export function buildCompanionBundle(
  raceId: string,
  result: RoadbookResult,
  verifiedStops: Record<string, VerifiedStopRecord>,
): CompanionBundle {
  const route = result.route;
  const totalKm = result.summary.distance_km;
  const coordinates = route.track_points.map(
    (point) => [point.lon, point.lat] as [number, number],
  );

  const unsupported = analyzeUnsupportedSections(result.resupply_zones, route, totalKm).map(
    (section) => ({
      id: section.id,
      startKm: section.startKm,
      endKm: section.endKm,
      distanceKm: section.distanceKm,
      displayLabel: section.displayLabel,
      riskLevel: section.riskLevel,
    }),
  );

  return {
    schemaVersion: COMPANION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    race: {
      id: raceId,
      name: result.summary.route_name,
      distanceKm: totalKm,
      elevationGainM: result.summary.elevation_gain_m,
    },
    route: {
      coordinates,
      bounds: buildBounds(route),
    },
    stops: result.resupply_zones
      .map((zone) => buildStop(zone, verifiedStops))
      .sort((left, right) => left.km - right.km),
    unsupportedSections: unsupported.sort((left, right) => left.startKm - right.startKm),
  };
}

export function downloadCompanionBundle(bundle: CompanionBundle): void {
  const slug = bundle.race.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "race"}-companion.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
