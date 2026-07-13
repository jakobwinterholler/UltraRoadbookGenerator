import type { RoutePreviewRuntime, RoutePreviewScene, TrackPoint } from "./types";

export function routeSamples(runtime: RoutePreviewRuntime): TrackPoint[] {
  if (runtime.routeSamples && runtime.routeSamples.length >= 2) {
    return runtime.routeSamples;
  }
  return runtime.track;
}

export function routeKmSpan(runtime: RoutePreviewRuntime): { startKm: number; endKm: number } {
  const samples = routeSamples(runtime);
  return { startKm: samples[0].km, endKm: samples[samples.length - 1].km };
}

export function sceneTerrainTrack(
  runtime: RoutePreviewRuntime,
  scene: RoutePreviewScene | { type: string; kmRange: { startKm: number; endKm: number } },
): TrackPoint[] {
  const pad = 12;
  const totalKm = runtime.distanceKm;

  if (scene.type === "overview") {
    return routeSamples(runtime);
  }

  let startKm = Math.max(0, scene.kmRange.startKm - pad);
  let endKm = Math.min(totalKm, scene.kmRange.endKm + pad);

  if (scene.type === "title") {
    startKm = 0;
    endKm = Math.min(12, totalKm);
  } else if (scene.type === "finish") {
    startKm = Math.max(0, totalKm - 12);
    endKm = totalKm;
  }

  const corridor = runtime.track.filter((point) => point.km >= startKm && point.km <= endKm);
  if (corridor.length >= 2) {
    return corridor;
  }

  const samples = routeSamples(runtime);
  const fallback = samples.filter((point) => point.km >= startKm && point.km <= endKm);
  return fallback.length >= 2 ? fallback : samples;
}

export function sceneTerrainZoom(sceneType: string): number {
  return sceneType === "overview" ? 11 : 14;
}

export function sceneById(runtime: RoutePreviewRuntime, sceneId: string): RoutePreviewScene | undefined {
  return runtime.scenes.find((scene) => scene.id === sceneId);
}
