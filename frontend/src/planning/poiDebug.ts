import type { PoiDebugRow } from "../api";
import { formatPoiName } from "../components/poiUi";

const EARTH_RADIUS_M = 6_371_000;

function distanceM(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function nearestPoiDebugEntry(
  entries: PoiDebugRow[],
  lat: number,
  lon: number,
  maxDistanceM = 180,
): PoiDebugRow | null {
  let best: PoiDebugRow | null = null;
  let bestDistance = maxDistanceM;

  for (const entry of entries) {
    if (entry.lat == null || entry.lon == null) {
      continue;
    }
    const distance = distanceM(lat, lon, entry.lat, entry.lon);
    if (distance <= bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }

  return best;
}

export function poiDebugTitle(entry: PoiDebugRow): string {
  return formatPoiName(entry.name, entry.brand, {
    poiCategory: entry.category ?? undefined,
  });
}

export function poiDebugStatusLabel(entry: PoiDebugRow): string {
  return entry.status === "imported" ? "Imported" : "Discarded";
}
