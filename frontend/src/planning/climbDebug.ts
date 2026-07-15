import type { ClimbCandidateRow, ClimbRow, TrackPoint } from "../api";
import { significantClimbs } from "@shared/race/significantClimbs";
import { findNearestTrackIndexByLatLng } from "../components/routeUtils";

const EARTH_RADIUS_M = 6_371_000;

function distanceM(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface ClimbDebugContext {
  clickKm: number;
  elevationSamples: Array<{ km: number; eleM: number | null }>;
  acceptedClimbs: ClimbRow[];
  significantClimbs: ClimbRow[];
  candidates: ClimbCandidateRow[];
  rejectedCandidates: ClimbCandidateRow[];
  activeClimb: ClimbRow | null;
  nearestCandidate: ClimbCandidateRow | null;
}

export function buildClimbDebugContext(
  trackPoints: TrackPoint[],
  climbs: ClimbRow[],
  candidates: ClimbCandidateRow[],
  lat: number,
  lon: number,
): ClimbDebugContext {
  const clickIndex = findNearestTrackIndexByLatLng(trackPoints, lat, lon);
  const clickKm = trackPoints[clickIndex]?.km ?? 0;
  const windowKm = 1.5;
  const elevationSamples = trackPoints
    .filter((point) => point.km >= clickKm - windowKm && point.km <= clickKm + windowKm)
    .map((point) => ({ km: point.km, eleM: point.ele_m }));

  const acceptedClimbs = [...climbs].sort((left, right) => left.start_km - right.start_km);
  const significant = significantClimbs(climbs);
  const rejectedCandidates = candidates.filter((candidate) => candidate.status === "rejected");
  const activeClimb =
    acceptedClimbs.find((climb) => clickKm >= climb.start_km && clickKm <= climb.end_km) ?? null;

  let nearestCandidate: ClimbCandidateRow | null = null;
  let nearestDistance = Infinity;
  for (const candidate of candidates) {
    const centerKm = (candidate.start_km + candidate.end_km) / 2;
    const centerPoint =
      trackPoints.find((point) => Math.abs(point.km - centerKm) < 0.05) ?? trackPoints[0];
    if (!centerPoint) {
      continue;
    }
    const distance = distanceM(lat, lon, centerPoint.lat, centerPoint.lon);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCandidate = candidate;
    }
  }

  return {
    clickKm,
    elevationSamples,
    acceptedClimbs,
    significantClimbs: significant,
    candidates,
    rejectedCandidates,
    activeClimb,
    nearestCandidate,
  };
}
