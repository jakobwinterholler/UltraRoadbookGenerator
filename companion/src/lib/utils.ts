import type { CompanionBundle, CompanionStop, ResupplyTimelineEntry } from "../types";

export function buildResupplyTimeline(
  bundle: CompanionBundle,
  includeUnverified: boolean,
): ResupplyTimelineEntry[] {
  const entries: ResupplyTimelineEntry[] = [];

  for (const stop of bundle.stops) {
    if (stop.verificationStatus === "verified" || includeUnverified) {
      entries.push({ kind: "stop", km: stop.km, stop });
    }
  }

  for (const section of bundle.unsupportedSections) {
    entries.push({ kind: "unsupported", km: section.startKm, section });
  }

  return entries.sort((left, right) => left.km - right.km || left.kind.localeCompare(right.kind));
}

export function formatKm(km: number): string {
  return `${Math.round(km)} km`;
}

export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function googleStreetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

export function stopByZoneId(bundle: CompanionBundle, zoneId: number): CompanionStop | null {
  return bundle.stops.find((stop) => stop.zoneId === zoneId) ?? null;
}
