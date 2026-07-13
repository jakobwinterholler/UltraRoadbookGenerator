import { clamp, lerp } from "./math";
import { routeSamples } from "./routeTrack";
import type { RoutePreviewRuntime } from "./types";

export interface ClimbProfilePoint {
  distIntoKm: number;
  eleM: number;
  km: number;
}

export interface ClimbProfileData {
  points: ClimbProfilePoint[];
  startKm: number;
  endKm: number;
  lengthKm: number;
  minEleM: number;
  maxEleM: number;
  name: string;
}

export function buildClimbProfile(runtime: RoutePreviewRuntime): ClimbProfileData | null {
  const climb = runtime.featuredClimb;
  if (!climb) {
    return null;
  }

  const denseCorridor = runtime.track.filter(
    (point) => point.km >= climb.startKm - 0.05 && point.km <= climb.endKm + 0.05,
  );
  const source = denseCorridor.length >= 2 ? denseCorridor : routeSamples(runtime);
  const points = source
    .filter((point) => point.km >= climb.startKm - 0.05 && point.km <= climb.endKm + 0.05)
    .map((point) => ({
      distIntoKm: Math.max(0, point.km - climb.startKm),
      eleM: point.ele_m,
      km: point.km,
    }));

  if (points.length < 2) {
    return null;
  }

  return {
    points,
    startKm: climb.startKm,
    endKm: climb.endKm,
    lengthKm: climb.lengthKm,
    minEleM: Math.min(...points.map((point) => point.eleM)),
    maxEleM: Math.max(...points.map((point) => point.eleM)),
    name: climb.name,
  };
}

export function profilePath(profile: ClimbProfileData, width: number, height: number, padding = 6): string {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  return profile.points
    .map((point, index) => {
      const x = padding + (point.distIntoKm / profile.lengthKm) * (width - padding * 2);
      const y = height - padding - ((point.eleM - profile.minEleM) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function profileMarker(profile: ClimbProfileData, distIntoKm: number, width: number, height: number, padding = 6) {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  const markerT = clamp(distIntoKm / Math.max(0.001, profile.lengthKm), 0, 1);
  const x = padding + markerT * (width - padding * 2);

  const targetKm = profile.startKm + distIntoKm;
  let eleM = profile.points[0].eleM;
  for (let index = 0; index < profile.points.length - 1; index += 1) {
    const current = profile.points[index];
    const next = profile.points[index + 1];
    if (targetKm >= current.km && targetKm <= next.km) {
      const blend = (targetKm - current.km) / Math.max(0.0001, next.km - current.km);
      eleM = lerp(current.eleM, next.eleM, blend);
      break;
    }
  }

  const y = height - padding - ((eleM - profile.minEleM) / span) * (height - padding * 2);
  return { x, y };
}
