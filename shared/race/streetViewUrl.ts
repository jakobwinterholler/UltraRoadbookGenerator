import { buildRouteTrack, haversineM, interpolateTrackAtKm } from "./mapMatching";

export interface StreetViewLocation {
  lat: number;
  lon: number;
  /** Google Place ID when available on the POI. */
  placeId?: string | null;
  /** Route km — used for debug logging and heading fallback only. */
  routeKm?: number;
  /** POI / business name — used for Maps fallback links only. */
  name?: string | null;
}

export interface StreetViewUrlOptions {
  routeCoordinates?: [number, number][];
  totalDistanceKm?: number;
  /** Field of view in degrees (default 75). */
  fov?: number;
  /** Camera pitch in degrees (default 0). */
  pitch?: number;
}

export const STREET_VIEW_SEARCH_RADIUS_M = 100;

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

export function bearingBetween(
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

/** GPX point on the route at stop km — for debug logging only. */
export function gpxPointAtStopKm(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): { lat: number; lon: number } | null {
  const coords = options?.routeCoordinates;
  if (!coords?.length || location.routeKm == null) {
    return null;
  }
  const track = buildRouteTrack(coords, options?.totalDistanceKm);
  const routePoint = interpolateTrackAtKm(track, location.routeKm);
  return { lat: routePoint.lat, lon: routePoint.lon };
}

export interface StreetViewDebugInfo {
  poiLat: number;
  poiLon: number;
  gpxLat: number | null;
  gpxLon: number | null;
  gpxDistanceFromPoiM: number | null;
  panoramaLat: number | null;
  panoramaLon: number | null;
  panoramaDistanceFromPoiM: number | null;
  heading: number | null;
  status: StreetViewMetadataStatus;
  poiName?: string | null;
}

export function logStreetViewDebug(debug: StreetViewDebugInfo): void {
  console.info("[StreetView]", {
    poi: `${debug.poiLat.toFixed(6)},${debug.poiLon.toFixed(6)}${debug.poiName ? ` (${debug.poiName})` : ""}`,
    gpx:
      debug.gpxLat != null && debug.gpxLon != null
        ? `${debug.gpxLat.toFixed(6)},${debug.gpxLon.toFixed(6)}`
        : null,
    gpxDistanceFromPoiM: debug.gpxDistanceFromPoiM,
    panorama:
      debug.panoramaLat != null && debug.panoramaLon != null
        ? `${debug.panoramaLat.toFixed(6)},${debug.panoramaLon.toFixed(6)}`
        : null,
    panoramaDistanceFromPoiM: debug.panoramaDistanceFromPoiM,
    heading: debug.heading,
    status: debug.status,
  });
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

export function buildStreetViewUrlFromPanorama(
  panorama: { lat: number; lon: number },
  poi: { lat: number; lon: number },
  options?: Pick<StreetViewUrlOptions, "fov" | "pitch"> & {
    placeId?: string | null;
    name?: string | null;
  },
): string {
  const fov = options?.fov ?? DEFAULT_FOV;
  const pitch = options?.pitch ?? DEFAULT_PITCH;
  const heading = bearingBetween(panorama, poi);
  const placeId = isGooglePlaceId(options?.placeId) ? options!.placeId!.trim() : null;

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${panorama.lat.toFixed(6)},${panorama.lon.toFixed(6)}`,
    heading: String(Math.round(heading)),
    pitch: String(pitch),
    fov: String(fov),
  });

  if (placeId) {
    params.set("query", `place_id:${placeId}`);
  } else if (options?.name?.trim()) {
    params.set("query", buildMapsSearchQuery({ lat: poi.lat, lon: poi.lon, name: options.name })!);
  }

  return `https://www.google.com/maps/@?${params.toString()}`;
}

/**
 * Best-effort Street View URL using POI coordinates (sync fallback before metadata resolves).
 */
export function googleStreetViewUrl(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): string {
  const poi = { lat: location.lat, lon: location.lon };
  const gpx = gpxPointAtStopKm(location, options);
  const heading =
    gpx != null && haversineM(gpx.lat, gpx.lon, poi.lat, poi.lon) >= 3
      ? bearingBetween(gpx, poi)
      : 0;

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${poi.lat.toFixed(6)},${poi.lon.toFixed(6)}`,
    heading: String(Math.round(heading)),
    pitch: String(options?.pitch ?? DEFAULT_PITCH),
    fov: String(options?.fov ?? DEFAULT_FOV),
  });

  const placeId = isGooglePlaceId(location.placeId) ? location.placeId!.trim() : null;
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

export interface StreetViewMetadataResult extends StreetViewAvailability {
  panorama: { lat: number; lon: number } | null;
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

function streetViewApiKey(options?: { apiKey?: string }): string | undefined {
  if (options?.apiKey) {
    return options.apiKey;
  }
  if (typeof import.meta !== "undefined") {
    return (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
      ?.VITE_GOOGLE_MAPS_API_KEY;
  }
  return undefined;
}

/** Fetch nearest Street View panorama within {@link STREET_VIEW_SEARCH_RADIUS_M} of the POI. */
export async function fetchStreetViewMetadata(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions & { apiKey?: string; radiusM?: number },
): Promise<StreetViewMetadataResult> {
  const poi = { lat: location.lat, lon: location.lon };
  const radius = options?.radiusM ?? STREET_VIEW_SEARCH_RADIUS_M;
  const params = new URLSearchParams({
    location: `${poi.lat},${poi.lon}`,
    radius: String(radius),
  });
  const apiKey = streetViewApiKey(options);
  if (apiKey) {
    params.set("key", apiKey);
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`,
    );
    if (!response.ok) {
      return { available: true, status: "UNKNOWN", panorama: null };
    }
    const data = (await response.json()) as {
      status?: string;
      location?: { lat: number; lng: number };
    };
    const parsed = parseStreetViewMetadataStatus(data.status);
    const panorama =
      parsed.available && data.location
        ? { lat: data.location.lat, lon: data.location.lng }
        : null;
    return { ...parsed, panorama };
  } catch {
    return { available: true, status: "UNKNOWN", panorama: null };
  }
}

export interface ResolvedStreetView {
  available: boolean;
  streetViewUrl: string | null;
  mapsFallbackUrl: string;
  debug: StreetViewDebugInfo;
}

/** Resolve Street View at the POI with nearest panorama search and POI-facing heading. */
export async function resolveStreetView(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions & { apiKey?: string },
): Promise<ResolvedStreetView> {
  const poi = { lat: location.lat, lon: location.lon };
  const gpx = gpxPointAtStopKm(location, options);
  const mapsFallbackUrl = googleStreetViewFallbackMapsUrl(location);

  const metadata = await fetchStreetViewMetadata(location, options);

  const debugBase: StreetViewDebugInfo = {
    poiLat: poi.lat,
    poiLon: poi.lon,
    poiName: location.name,
    gpxLat: gpx?.lat ?? null,
    gpxLon: gpx?.lon ?? null,
    gpxDistanceFromPoiM:
      gpx != null ? Math.round(haversineM(gpx.lat, gpx.lon, poi.lat, poi.lon)) : null,
    panoramaLat: null,
    panoramaLon: null,
    panoramaDistanceFromPoiM: null,
    heading: null,
    status: metadata.status,
  };

  if (!metadata.available || metadata.status === "ZERO_RESULTS" || !metadata.panorama) {
    const debug = { ...debugBase, status: metadata.status === "UNKNOWN" ? metadata.status : "ZERO_RESULTS" as const };
    logStreetViewDebug(debug);
    return {
      available: false,
      streetViewUrl: null,
      mapsFallbackUrl,
      debug,
    };
  }

  const panorama = metadata.panorama;
  const heading = bearingBetween(panorama, poi);
  const debug: StreetViewDebugInfo = {
    ...debugBase,
    panoramaLat: panorama.lat,
    panoramaLon: panorama.lon,
    panoramaDistanceFromPoiM: Math.round(
      haversineM(panorama.lat, panorama.lon, poi.lat, poi.lon),
    ),
    heading: Math.round(heading),
    status: "OK",
  };
  logStreetViewDebug(debug);

  return {
    available: true,
    streetViewUrl: buildStreetViewUrlFromPanorama(panorama, poi, {
      fov: options?.fov,
      pitch: options?.pitch,
      placeId: location.placeId,
      name: location.name,
    }),
    mapsFallbackUrl,
    debug,
  };
}

/** @deprecated Use resolveStreetView — kept for callers migrating incrementally. */
export async function checkStreetViewAvailability(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions & { apiKey?: string },
): Promise<StreetViewAvailability> {
  const result = await fetchStreetViewMetadata(location, options);
  return { available: result.available, status: result.status };
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
