import { buildRouteTrack, interpolateTrackAtKm } from "./mapMatching";

export interface StreetViewLocation {
  lat: number;
  lon: number;
  /** Google Place ID when available on the POI. */
  placeId?: string | null;
  /** Route km — used to aim the camera from the approach direction. */
  routeKm?: number;
}

export interface StreetViewUrlOptions {
  routeCoordinates?: [number, number][];
  totalDistanceKm?: number;
  /** Field of view in degrees (default 75). */
  fov?: number;
  /** Camera pitch in degrees (default 0). */
  pitch?: number;
}

const DEFAULT_FOV = 75;
const DEFAULT_PITCH = 0;

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

function streetViewHeading(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): number | undefined {
  const coords = options?.routeCoordinates;
  if (!coords?.length || location.routeKm == null) {
    return undefined;
  }
  const track = buildRouteTrack(coords, options?.totalDistanceKm);
  const routePoint = interpolateTrackAtKm(track, location.routeKm);
  return bearingBetween(
    { lat: routePoint.lat, lon: routePoint.lon },
    { lat: location.lat, lon: location.lon },
  );
}

export function googleMapsUrl(lat: number, lon: number, placeId?: string | null): string {
  if (placeId?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`place_id:${placeId.trim()}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Opens nearest Street View panorama facing the POI entrance.
 * Google Maps falls back to the map when no panorama exists at the viewpoint.
 */
export function googleStreetViewUrl(
  location: StreetViewLocation,
  options?: StreetViewUrlOptions,
): string {
  const fov = options?.fov ?? DEFAULT_FOV;
  const pitch = options?.pitch ?? DEFAULT_PITCH;
  const heading = streetViewHeading(location, options);

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
  });

  if (location.placeId?.trim()) {
    params.set("query", `place_id:${location.placeId.trim()}`);
  } else {
    params.set("viewpoint", `${location.lat},${location.lon}`);
  }

  if (heading != null && Number.isFinite(heading)) {
    params.set("heading", String(Math.round(heading)));
  }
  params.set("pitch", String(pitch));
  params.set("fov", String(fov));

  return `https://www.google.com/maps/@?${params.toString()}`;
}

export function normalizeWebsite(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}
