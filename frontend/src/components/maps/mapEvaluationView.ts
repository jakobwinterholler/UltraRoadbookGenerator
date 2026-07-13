import type { Map as LeafletMap } from "leaflet";
import { boundsForKmRange } from "../routeUtils";
import type { RouteVisualization } from "../../api";
import { boundsFromPoints } from "./planningMapView";

/** Evaluation viewport — generous context, no min-zoom crop. */
export function fitEvaluationScene(
  map: LeafletMap,
  route: RouteVisualization,
  startKm: number,
  endKm: number,
): void {
  const segmentBounds = boundsForKmRange(route.track_points, startKm, endKm);
  const bounds =
    segmentBounds ??
    boundsFromPoints(route.track_points) ??
    ([
      [route.bounds.south, route.bounds.west],
      [route.bounds.north, route.bounds.east],
    ] as [[number, number], [number, number]]);

  map.fitBounds(bounds, {
    padding: [28, 28],
    maxZoom: 13,
    animate: false,
  });
}
