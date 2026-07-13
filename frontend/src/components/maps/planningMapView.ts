import type { Map as LeafletMap } from "leaflet";
import type { RouteVisualization, TrackPoint } from "../../api";

export const PLANNING_FIT_PADDING: [number, number] = [16, 16];

export const PLANNING_FIT_PADDING_BY_CONTEXT: Record<
  PlanningViewContext,
  [number, number]
> = {
  workspace: [44, 44],
  overview: [36, 36],
  local: [32, 32],
  mini: [16, 16],
};

export type PlanningViewContext = "workspace" | "overview" | "local" | "mini";

/** Minimum zoom after fit — only for local/mini detail views. */
export const MIN_ZOOM_BY_CONTEXT: Partial<Record<PlanningViewContext, number>> = {
  local: 11,
  mini: 10,
};

export function boundsFromPoints(
  points: Array<{ lat: number; lon: number }>,
): [[number, number], [number, number]] | null {
  if (points.length === 0) {
    return null;
  }

  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lon;
  let east = points[0].lon;

  for (const point of points) {
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

/** Focus on a regional slice of very long routes so the map opens at a useful scale. */
export function regionalFocusPoints(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 2) {
    return points;
  }

  const totalKm = points[points.length - 1].km - points[0].km;
  if (totalKm <= 50) {
    return points;
  }
  if (totalKm <= 120) {
    const start = Math.floor(points.length * 0.15);
    const end = Math.ceil(points.length * 0.85);
    return points.slice(start, end);
  }

  const start = Math.floor(points.length * 0.38);
  const end = Math.ceil(points.length * 0.62);
  return points.slice(start, end);
}

export function fitPlanningBounds(
  map: LeafletMap,
  bounds: [[number, number], [number, number]],
  context: PlanningViewContext,
  options?: {
    padding?: [number, number];
    animate?: boolean;
    maxZoom?: number;
  },
): void {
  map.fitBounds(bounds, {
    padding: options?.padding ?? PLANNING_FIT_PADDING_BY_CONTEXT[context],
    maxZoom: options?.maxZoom ?? 14,
    animate: options?.animate ?? false,
  });

  const minZoom = MIN_ZOOM_BY_CONTEXT[context];
  if (minZoom !== undefined && map.getZoom() < minZoom) {
    map.setZoom(minZoom);
  }
}

export function fitPlanningRoute(
  map: LeafletMap,
  route: RouteVisualization,
  context: PlanningViewContext,
  options?: {
    padding?: [number, number];
    animate?: boolean;
    maxZoom?: number;
    regionalFocus?: boolean;
  },
): void {
  const points =
    options?.regionalFocus === true
      ? regionalFocusPoints(route.track_points)
      : route.track_points;
  const bounds = boundsFromPoints(points) ?? boundsFromPoints(route.track_points);

  if (!bounds) {
    return;
  }

  fitPlanningBounds(map, bounds, context, options);
}

export function fitPlanningPositions(
  map: LeafletMap,
  positions: [number, number][],
  context: PlanningViewContext,
  options?: {
    padding?: [number, number];
    animate?: boolean;
    maxZoom?: number;
  },
): void {
  const bounds = boundsFromPoints(positions.map(([lat, lon]) => ({ lat, lon })));
  if (!bounds) {
    return;
  }

  fitPlanningBounds(map, bounds, context, options);
}
