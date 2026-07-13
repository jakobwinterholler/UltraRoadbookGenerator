import type { TrackPoint } from "../api";
import { ROUTE_STYLE } from "../components/maps/planningMapTheme";

export const MAP_PREVIEW_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Fixed follow zoom — not adaptive, just close enough to read the map. */
export const MAP_FOLLOW_ZOOM = 12;

export interface FlyoverSample {
  lng: number;
  lat: number;
  bearing: number;
  km: number;
}

export function flyoverDurationS(distanceKm: number): number {
  return Math.min(900, Math.max(180, distanceKm * 0.8));
}

function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function bearingBetween(from: { lon: number; lat: number }, to: { lon: number; lat: number }): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

function lerpBearing(current: number, target: number, alpha: number): number {
  const delta = ((target - current + 540) % 360) - 180;
  return normalizeBearing(current + delta * alpha);
}

export function buildRouteCoordinates(points: TrackPoint[]): [number, number][] {
  return points
    .filter((point) => point.ele_m !== null)
    .map((point) => [point.lon, point.lat]);
}

export function sampleAtProgress(points: TrackPoint[], progress: number): FlyoverSample {
  if (points.length === 0) {
    return { lng: 0, lat: 0, bearing: 0, km: 0 };
  }
  if (points.length === 1) {
    return { lng: points[0].lon, lat: points[0].lat, bearing: 0, km: points[0].km };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const totalKm = points[points.length - 1].km;
  const targetKm = clamped * totalKm;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (targetKm >= current.km && targetKm <= next.km) {
      const span = Math.max(0.0001, next.km - current.km);
      const blend = (targetKm - current.km) / span;
      const lng = current.lon + (next.lon - current.lon) * blend;
      const lat = current.lat + (next.lat - current.lat) * blend;
      const lookAheadKm = Math.min(totalKm, targetKm + Math.max(0.4, totalKm * 0.002));
      let lookPoint = next;
      for (let ahead = index; ahead < points.length - 1; ahead += 1) {
        if (points[ahead].km >= lookAheadKm) {
          lookPoint = points[ahead];
          break;
        }
        lookPoint = points[ahead + 1];
      }
      const bearing = bearingBetween({ lon: lng, lat }, lookPoint);
      return { lng, lat, bearing, km: targetKm };
    }
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    lng: last.lon,
    lat: last.lat,
    bearing: bearingBetween(prev, last),
    km: last.km,
  };
}

export function smoothFlyoverSample(
  previous: FlyoverSample | null,
  next: FlyoverSample,
  alpha: number,
): FlyoverSample {
  if (!previous) {
    return next;
  }
  return {
    lng: previous.lng + (next.lng - previous.lng) * alpha,
    lat: previous.lat + (next.lat - previous.lat) * alpha,
    bearing: lerpBearing(previous.bearing, next.bearing, alpha),
    km: next.km,
  };
}

export const ROUTE_LAYER_PAINT = {
  lineColor: ROUTE_STYLE.core,
  lineWidth: 5,
  lineOpacity: 1,
} as const;

export const ROUTE_HALO_PAINT = {
  lineColor: ROUTE_STYLE.halo,
  lineWidth: 9,
  lineOpacity: 0.85,
} as const;
