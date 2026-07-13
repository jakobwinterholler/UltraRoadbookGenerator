import type { ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { colorAtKm, routeSegmentsForOverlay, zoneMarkerColor as resolveZoneMarkerColor } from "../planning/viewModel";
import type { OverlayMode, TimeMode } from "../planning/types";

export type { OverlayMode, TimeMode as PlanningMode } from "../planning/types";

export interface ColoredSegment {
  positions: [number, number][];
  color: string;
}

const NORMAL_ROUTE_COLOR = "#E85D04";

export function findNearestTrackIndex(points: TrackPoint[], km: number): number {
  if (points.length === 0) {
    return 0;
  }

  let bestIndex = 0;
  let bestDistance = Math.abs(points[0].km - km);

  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.abs(points[index].km - km);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function findNearestTrackIndexByLatLng(
  points: TrackPoint[],
  lat: number,
  lon: number,
): number {
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const dLat = point.lat - lat;
    const dLon = point.lon - lon;
    const score = dLat * dLat + dLon * dLon;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function trackPositionsInKmRange(
  points: TrackPoint[],
  startKm: number,
  endKm: number,
): [number, number][] {
  const positions = points
    .filter((point) => point.km >= startKm && point.km <= endKm)
    .map((point) => [point.lat, point.lon] as [number, number]);

  if (positions.length >= 2) {
    return positions;
  }

  const midKm = (startKm + endKm) / 2;
  const index = findNearestTrackIndex(points, midKm);
  const sliceStart = Math.max(0, index - 1);
  const sliceEnd = Math.min(points.length - 1, index + 1);
  return points
    .slice(sliceStart, sliceEnd + 1)
    .map((point) => [point.lat, point.lon] as [number, number]);
}

export function boundsForKmRange(
  points: TrackPoint[],
  startKm: number,
  endKm: number,
): [[number, number], [number, number]] | null {
  const subset = points.filter((point) => point.km >= startKm && point.km <= endKm);
  if (subset.length === 0) {
    return null;
  }

  let south = subset[0].lat;
  let north = subset[0].lat;
  let west = subset[0].lon;
  let east = subset[0].lon;

  for (const point of subset) {
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
  }

  return [
    [south, west],
    [north, east],
  ];
}

export function segmentPositionsForKmRange(
  points: TrackPoint[],
  startKm: number,
  endKm: number,
): [number, number][] {
  return points
    .filter((point) => point.km >= startKm && point.km <= endKm)
    .map((point) => [point.lat, point.lon] as [number, number]);
}

export function buildColoredSegments(
  route: RouteVisualization,
  overlay: OverlayMode,
): ColoredSegment[] {
  const points = route.track_points;
  if (points.length < 2) {
    return [];
  }

  const lookupSegments = routeSegmentsForOverlay({ route, overlay });

  if (overlay === "normal") {
    return [
      {
        positions: points.map((point) => [point.lat, point.lon]),
        color: NORMAL_ROUTE_COLOR,
      },
    ];
  }

  const segments: ColoredSegment[] = [];
  let currentColor = colorAtKm(points[0].km, lookupSegments);
  let currentPositions: [number, number][] = [[points[0].lat, points[0].lon]];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const nextColor = colorAtKm(point.km, lookupSegments);

    currentPositions.push([point.lat, point.lon]);

    if (nextColor !== currentColor) {
      segments.push({ positions: currentPositions, color: currentColor });
      currentColor = nextColor;
      currentPositions = [[point.lat, point.lon]];
    }
  }

  if (currentPositions.length > 1) {
    segments.push({ positions: currentPositions, color: currentColor });
  }

  return segments;
}

export function zoneMarkerColor(
  zone: ResupplyZone,
  overlay: OverlayMode,
  timeMode: TimeMode,
  route: RouteVisualization,
): string {
  const segments = routeSegmentsForOverlay({ route, overlay });
  return resolveZoneMarkerColor(zone, overlay, timeMode, segments);
}
