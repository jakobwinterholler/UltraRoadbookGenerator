import type maplibregl from "maplibre-gl";
import type { ResupplyZone, TrackPoint } from "../api";
import { formatPoiName } from "../components/poiUi";
import { poiIcon } from "../planning/poiMapMarkers";
import type { VerifiedStopRecord } from "../planning/stopVerification/types";

export interface RoutePreviewVerifiedStop {
  zoneId: number;
  km: number;
  lat: number;
  lon: number;
  icon: string;
  label: string;
}

export function buildVerifiedStopMarkers(
  zones: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
): RoutePreviewVerifiedStop[] {
  return zones
    .filter((zone) => verifiedStops[String(zone.zone_id)]?.status === "verified")
    .sort((left, right) => left.distance_along_km - right.distance_along_km)
    .map((zone) => {
      const water = zone.categories.find((cat) => cat.key === "water")?.primary;
      const food = zone.categories.find((cat) => cat.key === "food")?.primary;
      const fuel = zone.categories.find((cat) => cat.key === "fuel")?.primary;
      const poi =
        water ??
        food ??
        fuel ??
        zone.categories.find((cat) => cat.primary)?.primary ??
        null;

      const label = poi
        ? formatPoiName(poi.name, poi.brand, {
            poiCategory: poi.poi_category,
            categoryKey: zone.categories.find((cat) => cat.primary === poi)?.key,
          })
        : zone.name;

      return {
        zoneId: zone.zone_id,
        km: zone.distance_along_km,
        lat: zone.lat,
        lon: zone.lon,
        icon: poi ? poiIcon(poi.poi_category) : "✓",
        label,
      };
    });
}

export function elevationAtKm(points: TrackPoint[], km: number): number {
  if (points.length === 0) {
    return 0;
  }
  if (points.length === 1) {
    return points[0].ele_m ?? 0;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (km >= current.km && km <= next.km) {
      const span = Math.max(0.0001, next.km - current.km);
      const blend = (km - current.km) / span;
      const eleA = current.ele_m ?? next.ele_m ?? 0;
      const eleB = next.ele_m ?? current.ele_m ?? 0;
      return eleA + (eleB - eleA) * blend;
    }
  }

  return points[points.length - 1].ele_m ?? 0;
}

export interface RouteProfileData {
  points: TrackPoint[];
  minEleM: number;
  maxEleM: number;
  totalKm: number;
}

export function buildRouteProfileFromTrack(points: TrackPoint[]): RouteProfileData {
  const profilePoints = points.filter((point) => point.ele_m !== null);
  const elevations = profilePoints.map((point) => point.ele_m as number);
  const minEleM = elevations.length > 0 ? Math.min(...elevations) : 0;
  const maxEleM = elevations.length > 0 ? Math.max(...elevations) : 1;

  return {
    points: profilePoints,
    minEleM,
    maxEleM,
    totalKm: points[points.length - 1]?.km ?? 0,
  };
}

export function routeProfilePath(
  profile: RouteProfileData,
  width: number,
  height: number,
  padding = 4,
): string {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  return profile.points
    .map((point, index) => {
      const x =
        padding + (point.km / Math.max(0.001, profile.totalKm)) * (width - padding * 2);
      const y =
        height -
        padding -
        (((point.ele_m ?? profile.minEleM) - profile.minEleM) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function routeProfileMarkerAtKm(
  profile: RouteProfileData,
  points: TrackPoint[],
  km: number,
  width: number,
  height: number,
  padding = 4,
) {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  const eleM = elevationAtKm(points, km);
  const x = padding + (km / Math.max(0.001, profile.totalKm)) * (width - padding * 2);
  const y = height - padding - ((eleM - profile.minEleM) / span) * (height - padding * 2);
  return { x, y, eleM };
}

export interface MinimapProjection {
  pathD: string;
  width: number;
  height: number;
  marker: { x: number; y: number };
  headingDeg: number;
  sectionPathD: string | null;
}

function boundsForTrack(points: TrackPoint[]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  const latPad = Math.max(0.002, (maxLat - minLat) * 0.06);
  const lonPad = Math.max(0.002, (maxLon - minLon) * 0.06);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };
}

function projectPoint(
  point: Pick<TrackPoint, "lat" | "lon">,
  bounds: ReturnType<typeof boundsForTrack>,
  width: number,
  height: number,
  padding: number,
) {
  const xSpan = Math.max(1e-6, bounds.maxLon - bounds.minLon);
  const ySpan = Math.max(1e-6, bounds.maxLat - bounds.minLat);
  const x = padding + ((point.lon - bounds.minLon) / xSpan) * (width - padding * 2);
  const y = padding + (1 - (point.lat - bounds.minLat) / ySpan) * (height - padding * 2);
  return { x, y };
}

export function buildMinimapProjection(
  points: TrackPoint[],
  km: number,
  totalKm: number,
  sectionWindowKm = 10,
  width = 112,
  height = 112,
  padding = 8,
  currentPosition?: { lat: number; lon: number },
  playbackHeadingDeg?: number,
  routePoints?: Array<Pick<TrackPoint, "lat" | "lon" | "km">>,
): MinimapProjection {
  let routeLine = routePoints ?? points;
  if (routeLine.length > 600) {
    const stride = Math.ceil(routeLine.length / 600);
    routeLine = routeLine.filter((_, index) => index % stride === 0 || index === routeLine.length - 1);
  }
  const bounds = boundsForTrack(routeLine as TrackPoint[]);
  const pathD = routeLine
    .map((point, index) => {
      const { x, y } = projectPoint(point, bounds, width, height, padding);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const current = currentPosition ?? sampleTrackAtKm(points, km);
  const ahead = sampleTrackAtKm(points, Math.min(totalKm, km + 0.8));
  const marker = projectPoint(current, bounds, width, height, padding);
  const aheadPoint = projectPoint(ahead, bounds, width, height, padding);
  const headingDeg =
    playbackHeadingDeg ??
    (Math.atan2(aheadPoint.y - marker.y, aheadPoint.x - marker.x) * 180) / Math.PI;

  const sectionStart = Math.max(0, km - sectionWindowKm * 0.35);
  const sectionEnd = Math.min(totalKm, km + sectionWindowKm * 0.65);
  const sectionPoints = points.filter(
    (point) => point.km >= sectionStart && point.km <= sectionEnd,
  );

  let sectionPathD: string | null = null;
  if (sectionPoints.length >= 2) {
    sectionPathD = sectionPoints
      .map((point, index) => {
        const { x, y } = projectPoint(point, bounds, width, height, padding);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return { pathD, width, height, marker, headingDeg, sectionPathD };
}

export function projectKmOnMinimap(
  points: TrackPoint[],
  stop: Pick<RoutePreviewVerifiedStop, "km" | "lat" | "lon">,
  width: number,
  height: number,
  padding = 8,
) {
  const bounds = boundsForTrack(points);
  const trackPoint = sampleTrackAtKm(points, stop.km);
  return projectPoint(trackPoint, bounds, width, height, padding);
}

function sampleTrackAtKm(points: TrackPoint[], km: number): TrackPoint {
  if (points.length === 0) {
    return { lat: 0, lon: 0, km: 0, ele_m: 0, cumulative_gain_m: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (km >= current.km && km <= next.km) {
      const span = Math.max(0.0001, next.km - current.km);
      const blend = (km - current.km) / span;
      return {
        lat: current.lat + (next.lat - current.lat) * blend,
        lon: current.lon + (next.lon - current.lon) * blend,
        km,
        ele_m:
          current.ele_m !== null && next.ele_m !== null
            ? current.ele_m + (next.ele_m - current.ele_m) * blend
            : current.ele_m ?? next.ele_m,
        cumulative_gain_m: current.cumulative_gain_m,
      };
    }
  }

  return points[points.length - 1];
}

export function setMapInteractionLocked(map: maplibregl.Map, locked: boolean): void {
  const toggle = locked ? "disable" : "enable";
  map.scrollZoom[toggle]();
  map.boxZoom[toggle]();
  map.dragRotate[toggle]();
  map.dragPan[toggle]();
  map.keyboard[toggle]();
  map.doubleClickZoom[toggle]();
  map.touchZoomRotate[toggle]();
  if ("touchPitch" in map && map.touchPitch) {
    map.touchPitch[toggle]();
  }
}
