import { buildRouteTrack, interpolateTrackAtKm } from "@shared/race/mapMatching";

export interface RouteArrowFeature {
  type: "Feature";
  properties: { bearing: number };
  geometry: { type: "Point"; coordinates: [number, number] };
}

/** Sample direction arrow points along the route for symbol-placement. */
export function buildRouteArrowPoints(
  coordinates: [number, number][],
  totalKm: number,
  spacingKm = 2.5,
): GeoJSON.FeatureCollection {
  if (coordinates.length < 2 || totalKm <= 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const track = buildRouteTrack(coordinates, totalKm);
  const features: RouteArrowFeature[] = [];
  const step = Math.max(0.8, spacingKm);

  for (let km = step; km < totalKm; km += step) {
    const before = interpolateTrackAtKm(track, Math.max(0, km - 0.15));
    const after = interpolateTrackAtKm(track, Math.min(totalKm, km + 0.15));
    const bearing =
      (Math.atan2(after.lon - before.lon, after.lat - before.lat) * 180) / Math.PI;
    const point = interpolateTrackAtKm(track, km);
    features.push({
      type: "Feature",
      properties: { bearing },
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
    });
  }

  return { type: "FeatureCollection", features };
}
