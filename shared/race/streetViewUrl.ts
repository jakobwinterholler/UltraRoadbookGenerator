import { buildRouteTrack, haversineM, interpolateTrackAtKm } from "./mapMatching";

export interface StreetViewLocation {
  lat: number;
  lon: number;
  /** Google Place ID when available on the POI. */
  placeId?: string | null;
  /** Route km — used to aim the camera from the approach direction. */
  routeKm?: number;
  /** POI / business name — improves Google search when no Place ID. */
  name?: string | null;
}

export interface StreetViewUrlOptions {
  routeCoordinates?: [number, number][];
  totalDistanceKm?: number;
  /** Meters before the stop on the route to place the Street View camera. */
  approachOffsetM?: number;
  /** Field of view in degrees (default 75). */
  fov?: number;
  /** Camera pitch in degrees (default 0). */
  pitch?: number;
}

const DEFAULT_FOV = 75;
const DEFAULT_PITCH = 0;
/** Place the panorama on the road ~40 m before the stop, facing the POI. */
const DEFAULT_APPROACH_OFFSET_M = 40;

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
 * Street View panoramas sit on the road network. Place the camera on the route
 * slightly before the stop and look toward the POI entrance — not at the POI coords.
 */
export function computeStreetViewApproach(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): ApproachCamera {
  const poi = { lat: location.lat, lon: location.lon };
  const coords = options?.routeCoordinates;
  const offsetM = options?.approachOffsetM ?? DEFAULT_APPROACH_OFFSET_M;

  if (coords?.length && location.routeKm != null) {
    const track = buildRouteTrack(coords, options?.totalDistanceKm);
    const offsetKm = offsetM / 1000;
    const approachKm = Math.max(0, location.routeKm - offsetKm);
    const routePoint = interpolateTrackAtKm(track, approachKm);
    const viewpoint = { lat: routePoint.lat, lon: routePoint.lon };
    const heading = bearingBetween(viewpoint, poi);

    if (haversineM(viewpoint.lat, viewpoint.lon, poi.lat, poi.lon) >= 8) {
      return { viewpoint, heading };
    }

    const atStop = interpolateTrackAtKm(track, location.routeKm);
    const atStopPoint = { lat: atStop.lat, lon: atStop.lon };
    return {
      viewpoint: atStopPoint,
      heading: bearingBetween(atStopPoint, poi),
    };
  }

  return {
    viewpoint: poi,
    heading: 0,
  };
}

function buildDisambiguationQuery(location: StreetViewLocation): string | undefined {
  const name = location.name?.trim();
  if (!name) {
    return undefined;
  }
  return `${name}, ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
}

export function googleMapsUrl(lat: number, lon: number, placeId?: string | null): string {
  if (placeId?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`place_id:${placeId.trim()}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Opens Street View facing the POI entrance from the route approach.
 * With Place ID: query pins the business (no conflicting viewpoint).
 * Without Place ID: viewpoint on the road + heading toward the POI + name query.
 */
export function googleStreetViewUrl(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): string {
  const fov = options?.fov ?? DEFAULT_FOV;
  const pitch = options?.pitch ?? DEFAULT_PITCH;
  const approach = computeStreetViewApproach(location, options);
  const placeId = location.placeId?.trim();

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
  });

  if (placeId) {
    params.set("query", `place_id:${placeId}`);
    params.set("heading", String(Math.round(approach.heading)));
  } else {
    params.set(
      "viewpoint",
      `${approach.viewpoint.lat.toFixed(6)},${approach.viewpoint.lon.toFixed(6)}`,
    );
    params.set("heading", String(Math.round(approach.heading)));
    const query = buildDisambiguationQuery(location);
    if (query) {
      params.set("query", query);
    }
  }

  params.set("pitch", String(pitch));
  params.set("fov", String(fov));

  return `https://www.google.com/maps/@?${params.toString()}`;
}

/** Maps search URL — use when Street View has no coverage at the POI. */
export function googleStreetViewFallbackMapsUrl(
  location: Pick<StreetViewLocation, "lat" | "lon" | "placeId" | "name">,
): string {
  if (location.placeId?.trim()) {
    return googleMapsUrl(location.lat, location.lon, location.placeId);
  }
  const query = buildDisambiguationQuery(location as StreetViewLocation);
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

export function placeIdFromTags(
  tags?: Record<string, string> | null,
  direct?: string | null,
): string | null {
  if (direct?.trim()) {
    return direct.trim();
  }
  if (!tags) {
    return null;
  }
  for (const key of ["place_id", "google_place_id", "google:place_id"]) {
    const value = tags[key];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return null;
}
