import type { RouteVisualization } from "../../api";
import { boundsForKmRange } from "../routeUtils";

export interface RouteSceneViewport {
  lat: number;
  lon: number;
  zoom: number;
}

function zoomForSpan(maxSpanDegrees: number): number {
  if (maxSpanDegrees < 0.02) return 14;
  if (maxSpanDegrees < 0.05) return 13;
  if (maxSpanDegrees < 0.12) return 12;
  if (maxSpanDegrees < 0.25) return 11;
  if (maxSpanDegrees < 0.6) return 10;
  if (maxSpanDegrees < 1.2) return 9;
  return 8;
}

export function viewportForScene(
  route: RouteVisualization,
  startKm: number,
  endKm: number,
): RouteSceneViewport {
  const bounds = boundsForKmRange(route.track_points, startKm, endKm);
  const subset = route.track_points.filter((point) => point.km >= startKm && point.km <= endKm);

  if (bounds) {
    const [[south, west], [north, east]] = bounds;
    const lat = (south + north) / 2;
    const lon = (west + east) / 2;
    const span = Math.max(north - south, east - west);
    return { lat, lon, zoom: zoomForSpan(span) };
  }

  if (subset.length > 0) {
    const mid = subset[Math.floor(subset.length / 2)];
    return { lat: mid.lat, lon: mid.lon, zoom: 11 };
  }

  const mid = route.track_points[Math.floor(route.track_points.length / 2)];
  return { lat: mid?.lat ?? 46.5, lon: mid?.lon ?? 8, zoom: 10 };
}
