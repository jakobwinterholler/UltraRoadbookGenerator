import type { ResupplyZone } from "../../api";
import type { VerifiedStopRecord } from "../../planning/stopVerification/types";
import { formatGradient } from "./math";
import { gradientOverWindow, interpolateTrack, routeProgressAtTime } from "./progress";
import { routeSamples } from "./routeTrack";
import type { RoutePreviewRuntime, TrackPoint } from "./types";

export interface RouteProfileData {
  points: TrackPoint[];
  minEleM: number;
  maxEleM: number;
  totalKm: number;
}

export interface MinimapProjection {
  pathD: string;
  width: number;
  height: number;
  marker: { x: number; y: number };
  headingDeg: number;
  sectionPathD: string | null;
}

export interface VerifiedStopTimelineItem {
  zoneId: number;
  name: string;
  km: number;
  status: "passed" | "current" | "upcoming";
  distanceKm: number | null;
  detail: string | null;
}

export interface CompanionState {
  km: number;
  totalKm: number;
  kmDone: number;
  kmRemaining: number;
  pctComplete: number;
  elevationM: number;
  gradientPct: number;
  sectionTitle: string;
  sectionSubtitle: string;
  inClimb: boolean;
  climbName: string | null;
}

export function buildRouteProfile(runtime: RoutePreviewRuntime): RouteProfileData {
  const points = routeSamples(runtime);
  const elevations = points.map((point) => point.ele_m);
  return {
    points,
    minEleM: Math.min(...elevations),
    maxEleM: Math.max(...elevations),
    totalKm: runtime.distanceKm,
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
      const x = padding + (point.km / Math.max(0.001, profile.totalKm)) * (width - padding * 2);
      const y = height - padding - ((point.ele_m - profile.minEleM) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function routeProfileMarker(
  runtime: RoutePreviewRuntime,
  profile: RouteProfileData,
  km: number,
  width: number,
  height: number,
  padding = 4,
) {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  const point = interpolateTrack(runtime, km);
  const x = padding + (km / Math.max(0.001, profile.totalKm)) * (width - padding * 2);
  const y = height - padding - ((point.ele_m - profile.minEleM) / span) * (height - padding * 2);
  return { x, y, eleM: point.ele_m };
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
  point: TrackPoint,
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
  runtime: RoutePreviewRuntime,
  km: number,
  sectionStartKm: number | null,
  sectionEndKm: number | null,
  width = 120,
  height = 120,
  padding = 8,
): MinimapProjection {
  const points = routeSamples(runtime);
  const bounds = boundsForTrack(points);
  const pathD = points
    .map((point, index) => {
      const { x, y } = projectPoint(point, bounds, width, height, padding);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const current = interpolateTrack(runtime, km);
  const ahead = interpolateTrack(runtime, Math.min(runtime.distanceKm, km + 0.8));
  const marker = projectPoint(current, bounds, width, height, padding);
  const aheadPoint = projectPoint(ahead, bounds, width, height, padding);
  const headingDeg =
    (Math.atan2(aheadPoint.y - marker.y, aheadPoint.x - marker.x) * 180) / Math.PI;

  let sectionPathD: string | null = null;
  if (sectionStartKm !== null && sectionEndKm !== null) {
    const sectionPoints = points.filter(
      (point) => point.km >= sectionStartKm && point.km <= sectionEndKm,
    );
    if (sectionPoints.length >= 2) {
      sectionPathD = sectionPoints
        .map((point, index) => {
          const { x, y } = projectPoint(point, bounds, width, height, padding);
          return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    }
  }

  return { pathD, width, height, marker, headingDeg, sectionPathD };
}

export function companionStateAtTime(runtime: RoutePreviewRuntime, timeS: number): CompanionState {
  const progress = routeProgressAtTime(runtime, timeS);
  const point = interpolateTrack(runtime, progress.km);
  const totalKm = runtime.distanceKm;
  const kmDone = progress.km;
  const kmRemaining = Math.max(0, totalKm - progress.km);

  let sectionSubtitle = `km ${Math.round(progress.km)} of ${Math.round(totalKm)}`;
  if (progress.inClimb && runtime.featuredClimb) {
    sectionSubtitle = `Climbing · ${runtime.featuredClimb.name}`;
  } else if (progress.scene.sceneType === "verified_stop") {
    sectionSubtitle = "Approaching verified stop";
  } else if (progress.scene.sceneType === "unsupported") {
    sectionSubtitle = "Unsupported section";
  } else if (progress.scene.sceneType === "overview") {
    sectionSubtitle = "Full route";
  }

  return {
    km: progress.km,
    totalKm,
    kmDone,
    kmRemaining,
    pctComplete: (progress.km / Math.max(0.001, totalKm)) * 100,
    elevationM: point.ele_m,
    gradientPct: gradientOverWindow(runtime, progress.km, 200),
    sectionTitle: progress.scene.title,
    sectionSubtitle,
    inClimb: progress.inClimb,
    climbName: progress.inClimb ? runtime.featuredClimb?.name ?? null : null,
  };
}

function primaryPoiLabel(zone: ResupplyZone): string | null {
  const water = zone.categories.find((cat) => cat.key === "water")?.primary;
  const food = zone.categories.find((cat) => cat.key === "food")?.primary;
  const poi = water ?? food ?? zone.categories.find((cat) => cat.primary)?.primary;
  if (!poi) {
    return null;
  }
  return poi.name || poi.brand || null;
}

export function buildVerifiedStopTimeline(
  zones: ResupplyZone[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  currentKm: number,
  maxPassed = 2,
  maxUpcoming = 3,
): VerifiedStopTimelineItem[] {
  const verifiedZones = zones
    .filter((zone) => verifiedStops[String(zone.zone_id)]?.status === "verified")
    .sort((left, right) => left.distance_along_km - right.distance_along_km);

  const passed = verifiedZones.filter((zone) => zone.distance_along_km < currentKm - 0.5);
  const upcoming = verifiedZones.filter((zone) => zone.distance_along_km >= currentKm - 0.5);

  const items: VerifiedStopTimelineItem[] = [];

  for (const zone of passed.slice(-maxPassed)) {
    items.push({
      zoneId: zone.zone_id,
      name: zone.name,
      km: zone.distance_along_km,
      status: "passed",
      distanceKm: null,
      detail: primaryPoiLabel(zone),
    });
  }

  for (const [index, zone] of upcoming.slice(0, maxUpcoming).entries()) {
    const distanceKm = Math.max(0, zone.distance_along_km - currentKm);
    items.push({
      zoneId: zone.zone_id,
      name: zone.name,
      km: zone.distance_along_km,
      status: index === 0 && distanceKm < 2 ? "current" : "upcoming",
      distanceKm,
      detail: primaryPoiLabel(zone),
    });
  }

  return items;
}

export function formatCompanionGradient(gradientPct: number): string {
  if (Math.abs(gradientPct) < 0.4) {
    return "Flat";
  }
  return formatGradient(gradientPct);
}
