import { clamp, lerp, smootherstep } from "./math";
import { gradientOverWindow, interpolateTrack, routeProgressAtTime } from "./progress";
import { sceneIndexAtTime } from "./timeline";
import type {
  ClimbStripState,
  OverlayFrameState,
  RoutePreviewOverlayMode,
  RoutePreviewRuntime,
  RoutePreviewScene,
} from "./types";

const GRADIENT_WINDOW_M = 200;

function sceneById(runtime: RoutePreviewRuntime, sceneId: string): RoutePreviewScene | undefined {
  return runtime.scenes.find((scene) => scene.id === sceneId);
}

function defaultOverlayMode(scene: RoutePreviewScene): RoutePreviewOverlayMode {
  switch (scene.type) {
    case "climb":
      return "climb";
    case "overview":
    case "title":
    case "finish":
      return "breath";
    default:
      return "card";
  }
}

function isInSceneTransition(runtime: RoutePreviewRuntime, timeS: number): boolean {
  const index = sceneIndexAtTime(runtime.timeline, timeS);
  const scene = runtime.timeline[index];
  if (!scene || scene.transitionAfterS <= 0) {
    return false;
  }
  return timeS > scene.endS && timeS < scene.endS + scene.transitionAfterS;
}

/** Brief fade-in, hold, fade-out — overlays follow the ride, not the other way around. */
function overlayOpacityForScene(localT: number, sceneType: string, overlayMode: RoutePreviewOverlayMode): number {
  if (overlayMode === "breath") {
    if (sceneType === "title") {
      return smootherstep(0.04, 0.12, localT) * (1 - smootherstep(0.35, 0.5, localT));
    }
    if (sceneType === "overview") {
      return smootherstep(0.06, 0.14, localT) * (1 - smootherstep(0.2, 0.32, localT));
    }
    if (sceneType === "finish") {
      return smootherstep(0.55, 0.68, localT) * (1 - smootherstep(0.88, 0.98, localT));
    }
    return 0;
  }

  const fadeIn = smootherstep(0.08, 0.18, localT);
  const fadeOut = 1 - smootherstep(0.62, 0.78, localT);
  return fadeIn * fadeOut;
}

function overlayContentForScene(
  runtime: RoutePreviewRuntime,
  sceneId: string,
): OverlayFrameState["content"] {
  const scene = sceneById(runtime, sceneId);
  if (!scene?.overlay) {
    if (!scene) {
      return null;
    }
    return {
      eyebrow: scene.type.replace("_", " "),
      name: scene.title,
      statsLines: [scene.description],
      narrative: scene.whyChosen,
    };
  }
  return {
    eyebrow: scene.overlay.eyebrow,
    name: scene.overlay.name,
    statsLines: scene.overlay.statsLines,
    narrative: scene.overlay.narrative ?? scene.whyChosen,
    waterLabel: scene.overlay.waterLabel,
    waterValue: scene.overlay.waterValue,
  };
}

function cardOpacityForScene(
  runtime: RoutePreviewRuntime,
  timeS: number,
): { opacity: number; translateY: number; content: OverlayFrameState["content"] } {
  const progress = routeProgressAtTime(runtime, timeS);
  const scene = sceneById(runtime, progress.scene.sceneId);
  const overlayMode = scene?.overlayMode ?? (scene ? defaultOverlayMode(scene) : "card");
  const content = overlayContentForScene(runtime, progress.scene.sceneId);

  if (!content || overlayMode === "none") {
    return { opacity: 0, translateY: 18, content: null };
  }

  let opacity = overlayOpacityForScene(progress.localT, progress.scene.sceneType, overlayMode);

  if (isInSceneTransition(runtime, timeS)) {
    opacity = 0;
  }

  return {
    opacity: clamp(opacity, 0, 1),
    translateY: lerp(18, 0, opacity),
    content,
  };
}

function climbStripState(runtime: RoutePreviewRuntime, timeS: number): ClimbStripState | null {
  const climb = runtime.featuredClimb;
  if (!climb) {
    return null;
  }

  const progress = routeProgressAtTime(runtime, timeS);
  if (progress.scene.sceneType !== "climb") {
    return null;
  }

  if (isInSceneTransition(runtime, timeS)) {
    return null;
  }

  const opacity = overlayOpacityForScene(progress.localT, "climb", "climb");
  if (opacity < 0.05) {
    return null;
  }

  const distIntoKm = clamp(progress.km - climb.startKm, 0, climb.lengthKm);
  const distRemainingKm = clamp(climb.endKm - progress.km, 0, climb.lengthKm);
  const current = interpolateTrack(runtime, progress.km);
  const profileStart = interpolateTrack(runtime, climb.startKm);
  const profileEnd = interpolateTrack(runtime, climb.endKm);
  const gainedM = Math.max(0, current.ele_m - profileStart.ele_m);
  const remainingM = Math.max(0, profileEnd.ele_m - current.ele_m);

  return {
    visible: true,
    opacity,
    distIntoKm,
    distRemainingKm,
    gainedM,
    remainingM,
    altitudeM: current.ele_m,
    altitudeSub: progress.inClimb ? climb.name : "Approaching climb",
    gradientPct: gradientOverWindow(runtime, progress.km, GRADIENT_WINDOW_M),
    gradientWindowM: GRADIENT_WINDOW_M,
    markerT: clamp(distIntoKm / Math.max(0.001, climb.lengthKm), 0, 1),
    lastVerifiedWater: climb.lastVerifiedWater ?? null,
  };
}

export function overlayStateAtTime(
  runtime: RoutePreviewRuntime,
  timeS: number,
): OverlayFrameState {
  const card = cardOpacityForScene(runtime, timeS);
  return {
    visible: card.opacity > 0.01 && card.content !== null,
    opacity: card.opacity,
    translateY: card.translateY,
    content: card.content,
    climbStrip: climbStripState(runtime, timeS),
    inTransition: isInSceneTransition(runtime, timeS),
  };
}

export { gradientOverWindow };
