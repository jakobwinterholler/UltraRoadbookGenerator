import type { CompanionBundle, CompanionStop, ResupplyTimelineEntry } from "../types";
import {
  googleMapsUrl as sharedGoogleMapsUrl,
  googleStreetViewUrl as sharedGoogleStreetViewUrl,
  type StreetViewUrlOptions,
} from "@shared/race/streetViewUrl";

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

export function googleMapsUrl(lat: number, lon: number, placeId?: string | null): string {
  return sharedGoogleMapsUrl(lat, lon, placeId);
}

export function googleStreetViewUrl(
  stop: Pick<CompanionStop, "lat" | "lon" | "placeId" | "km">,
  options?: StreetViewUrlOptions,
): string {
  return sharedGoogleStreetViewUrl(
    {
      lat: stop.lat,
      lon: stop.lon,
      placeId: stop.placeId,
      routeKm: stop.km,
    },
    options,
  );
}

export function stopByZoneId(bundle: CompanionBundle, zoneId: number): CompanionStop | null {
  return bundle.stops.find((stop) => stop.zoneId === zoneId) ?? null;
}
