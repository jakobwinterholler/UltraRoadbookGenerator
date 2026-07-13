import { lerp, smootherstep } from "./math";
import type {
  RoutePreviewRuntime,
  RoutePreviewScene,
  RoutePreviewTimelineEntry,
} from "./types";

function sceneForTimelineEntry(
  runtime: RoutePreviewRuntime,
  entry: RoutePreviewTimelineEntry,
): RoutePreviewScene | undefined {
  return runtime.scenes.find((scene) => scene.id === entry.sceneId);
}

export function kmSpanForScene(
  runtime: RoutePreviewRuntime,
  scene: RoutePreviewTimelineEntry,
  sceneMeta: RoutePreviewScene | undefined,
): { startKm: number; endKm: number } {
  if (scene.sceneType === "climb" && runtime.featuredClimb) {
    return {
      startKm: sceneMeta?.kmRange.startKm ?? runtime.featuredClimb.startKm,
      endKm: sceneMeta?.kmRange.endKm ?? runtime.featuredClimb.endKm,
    };
  }
  if (scene.sceneType === "overview") {
    const samples = runtime.routeSamples?.length ? runtime.routeSamples : runtime.track;
    return {
      startKm: samples[0]?.km ?? scene.kmRange.startKm,
      endKm: samples[samples.length - 1]?.km ?? scene.kmRange.endKm,
    };
  }
  return {
    startKm: sceneMeta?.kmRange.startKm ?? scene.kmRange.startKm,
    endKm: sceneMeta?.kmRange.endKm ?? scene.kmRange.endKm,
  };
}

/**
 * Continuous flyover easing — camera never stops.
 * Feature scenes spend slightly more time mid-segment (slowdown, not hold).
 */
export function flyoverEase(localT: number, sceneType: string): number {
  const t = clamp01(localT);
  const featureScenes = new Set(["climb", "verified_stop", "unsupported", "remote"]);
  if (featureScenes.has(sceneType)) {
    // Gentle ease-in-out: slightly slower through the middle third.
    return smootherstep(0, 1, t);
  }
  if (sceneType === "overview") {
    // Long flowing pass — smooth start and end, steady middle.
    return smootherstep(0.01, 0.99, t);
  }
  return smootherstep(0.03, 0.97, t);
}

export function flyoverKmAtLocalT(
  runtime: RoutePreviewRuntime,
  scene: RoutePreviewTimelineEntry,
  localT: number,
): number {
  const sceneMeta = sceneForTimelineEntry(runtime, scene);
  const span = kmSpanForScene(runtime, scene, sceneMeta);
  const kmT = flyoverEase(localT, scene.sceneType);
  return lerp(span.startKm, span.endKm, kmT);
}

export function learningGoalForScene(
  runtime: RoutePreviewRuntime,
  sceneId: string,
): string | null {
  const scene = runtime.scenes.find((item) => item.id === sceneId);
  return scene?.description ?? scene?.whyChosen ?? null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
