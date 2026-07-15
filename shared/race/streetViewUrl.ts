import { buildRouteTrack, haversineM, interpolateTrackAtKm } from "./mapMatching";

export interface StreetViewLocation {
  lat: number;
  lon: number;
  /** Google Place ID when available on the POI. */
  placeId?: string | null;
  /** Route km — used to aim the camera from the approach direction. */
  routeKm?: number;
  /** POI / business name — used for Maps fallback links only. */
  name?: string | null;
}

export interface StreetViewUrlOptions {
  routeCoordinates?: [number, number][];
  totalDistanceKm?: number;
  /** Meters before the stop on the route when computing camera heading. */
  approachOffsetM?: number;
  /** Field of view in degrees (default 75). */
  fov?: number;
  /** Camera pitch in degrees (default 0). */
  pitch?: number;
}

const DEFAULT_FOV = 75;
const DEFAULT_PITCH = 0;

/** Real Google Place IDs start with ChI/GhI/EhI — OSM tags are often not valid. */
export function isGooglePlaceId(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 10) {
    return false;
  }
  return /^(ChI|GhI|EhI)/.test(trimmed);
}

function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function bearingBetween(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

interface ApproachCamera {
  viewpoint: { lat: number; lon: number };
  heading: number;
}

/**
 * Places the Street View camera on the route at the stop km, facing the POI.
 * Gas stations and other off-route POIs otherwise snap to the wrong road panorama.
 */
export function computeStreetViewApproach(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): ApproachCamera {
  const poi = { lat: location.lat, lon: location.lon };
  const coords = options?.routeCoordinates;

  if (coords?.length && location.routeKm != null) {
    const track = buildRouteTrack(coords, options?.totalDistanceKm);
    const routePoint = interpolateTrackAtKm(track, location.routeKm);
    const viewpoint = { lat: routePoint.lat, lon: routePoint.lon };

    if (haversineM(viewpoint.lat, viewpoint.lon, poi.lat, poi.lon) >= 5) {
      return {
        viewpoint,
        heading: bearingBetween(viewpoint, poi),
      };
    }
  }

  return { viewpoint: poi, heading: 0 };
}

function buildMapsSearchQuery(location: StreetViewLocation): string | undefined {
  const name = location.name?.trim();
  if (!name) {
    return undefined;
  }
  return `${name}, ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
}

export function googleMapsUrl(lat: number, lon: number, placeId?: string | null): string {
  if (isGooglePlaceId(placeId)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`place_id:${placeId!.trim()}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Opens Street View at the POI with the camera facing the building from the route approach.
 */
export function googleStreetViewUrl(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): string {
  const fov = options?.fov ?? DEFAULT_FOV;
  const pitch = options?.pitch ?? DEFAULT_PITCH;
  const approach = computeStreetViewApproach(location, options);
  const placeId = isGooglePlaceId(location.placeId) ? location.placeId!.trim() : null;

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${approach.viewpoint.lat.toFixed(6)},${approach.viewpoint.lon.toFixed(6)}`,
    heading: String(Math.round(approach.heading)),
    pitch: String(pitch),
    fov: String(fov),
  });

  if (placeId) {
    params.set("query", `place_id:${placeId}`);
  } else {
    const query = buildMapsSearchQuery(location);
    if (query) {
      params.set("query", query);
    }
  }

  return `https://www.google.com/maps/@?${params.toString()}`;
}

/** Maps search URL — use when Street View has no coverage at the POI. */
export function googleStreetViewFallbackMapsUrl(
  location: Pick<StreetViewLocation, "lat" | "lon" | "placeId" | "name">,
): string {
  if (isGooglePlaceId(location.placeId)) {
    return googleMapsUrl(location.lat, location.lon, location.placeId);
  }
  const query = buildMapsSearchQuery(location as StreetViewLocation);
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return googleMapsUrl(location.lat, location.lon);
}

export function normalizeWebsite(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

export type StreetViewMetadataStatus = "OK" | "ZERO_RESULTS" | "UNKNOWN";

export interface StreetViewAvailability {
  available: boolean;
  status: StreetViewMetadataStatus;
}

export function parseStreetViewMetadataStatus(status: string | undefined): StreetViewAvailability {
  if (status === "OK") {
    return { available: true, status: "OK" };
  }
  if (status === "ZERO_RESULTS") {
    return { available: false, status: "ZERO_RESULTS" };
  }
  return { available: true, status: "UNKNOWN" };
}

/** Check whether Google has Street View coverage near the route approach point. */
export async function checkStreetViewAvailability(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions & { apiKey?: string },
): Promise<StreetViewAvailability> {
  const approach = computeStreetViewApproach(location, options);
  const envKey =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env?.VITE_GOOGLE_MAPS_API_KEY
      : undefined;
  const params = new URLSearchParams({
    location: `${approach.viewpoint.lat},${approach.viewpoint.lon}`,
  });
  const apiKey = options?.apiKey ?? envKey;
  if (apiKey) {
    params.set("key", apiKey);
  }
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`,
    );
    if (!response.ok) {
      return { available: true, status: "UNKNOWN" };
    }
    const data = (await response.json()) as { status?: string };
    return parseStreetViewMetadataStatus(data.status);
  } catch {
    return { available: true, status: "UNKNOWN" };
  }
}

export function placeIdFromTags(
  tags?: Record<string, string> | null,
  direct?: string | null,
): string | null {
  if (isGooglePlaceId(direct)) {
    return direct!.trim();
  }
  if (!tags) {
    return null;
  }
  for (const key of ["place_id", "google_place_id", "google:place_id"]) {
    const value = tags[key];
    if (isGooglePlaceId(value)) {
      return value.trim();
    }
  }
  return null;
}
