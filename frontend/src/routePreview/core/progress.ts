import { clamp } from "./math";
import { flyoverKmAtLocalT } from "./sceneBeats";
import { routeSamples } from "./routeTrack";
import { localSceneProgress, sceneAtTime, sceneIndexAtTime } from "./timeline";
import type { RoutePreviewRuntime, RouteProgress } from "./types";

export function routeProgressAtTime(
  runtime: RoutePreviewRuntime,
  timeS: number,
): RouteProgress {
  const sceneIndex = sceneIndexAtTime(runtime.timeline, timeS);
  const scene = sceneAtTime(runtime.timeline, timeS);
  const localT = localSceneProgress(scene, timeS);
  const km = flyoverKmAtLocalT(runtime, scene, localT);

  const climb = runtime.featuredClimb;
  const inClimb = climb ? km >= climb.startKm && km <= climb.endKm : false;
  const climbT =
    climb && inClimb
      ? clamp((km - climb.startKm) / Math.max(0.001, climb.endKm - climb.startKm), 0, 1)
      : 0;

  return {
    timeS,
    scene,
    sceneIndex,
    localT,
    km,
    inClimb,
    climbT,
  };
}

export function interpolateTrack(runtime: RoutePreviewRuntime, km: number) {
  const track = routeSamples(runtime);
  if (track.length === 0) {
    throw new Error("Route preview runtime does not include track points.");
  }
  if (km <= track[0].km) {
    return track[0];
  }
  if (km >= track[track.length - 1].km) {
    return track[track.length - 1];
  }

  for (let index = 0; index < track.length - 1; index += 1) {
    const current = track[index];
    const next = track[index + 1];
    if (km >= current.km && km <= next.km) {
      const blend = (km - current.km) / Math.max(0.0001, next.km - current.km);
      return {
        lat: current.lat + (next.lat - current.lat) * blend,
        lon: current.lon + (next.lon - current.lon) * blend,
        km,
        ele_m: current.ele_m + (next.ele_m - current.ele_m) * blend,
      };
    }
  }

  return track[track.length - 1];
}

export function gradientOverWindow(
  runtime: RoutePreviewRuntime,
  km: number,
  windowM = 200,
): number {
  const track = routeSamples(runtime);
  const routeStartKm = track[0]?.km ?? 0;
  const startKm = Math.max(routeStartKm, km - windowM / 1000);
  const start = interpolateTrack(runtime, startKm);
  const end = interpolateTrack(runtime, km);
  const rise = end.ele_m - start.ele_m;
  const runM = Math.max(1, (km - startKm) * 1000);
  return (rise / runM) * 100;
}
