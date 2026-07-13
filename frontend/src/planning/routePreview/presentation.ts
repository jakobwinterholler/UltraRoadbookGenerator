import type { RoutePreviewSceneType } from "./types";

const TYPE_LABELS: Record<RoutePreviewSceneType, string> = {
  title: "Title",
  overview: "Overview",
  start: "Start",
  finish: "Finish",
  climb: "Climb",
  town: "Town",
  verified_stop: "Verified stop",
  unsupported: "Unsupported",
  remote: "Remote",
  scenery: "Scenery",
  coastline: "Coastline",
  valley: "Valley",
  gravel: "Gravel",
  highest_point: "Highest point",
};

const TYPE_EMOJI: Record<RoutePreviewSceneType, string> = {
  title: "🎬",
  overview: "🗺",
  start: "🚩",
  finish: "🏁",
  climb: "🏔",
  town: "🏙",
  verified_stop: "✓",
  unsupported: "💧",
  remote: "🌲",
  scenery: "🌄",
  coastline: "🌊",
  valley: "⛰",
  gravel: "🪨",
  highest_point: "📍",
};

export function routePreviewTypeLabel(type: RoutePreviewSceneType): string {
  return TYPE_LABELS[type];
}

export function routePreviewTypeEmoji(type: RoutePreviewSceneType): string {
  return TYPE_EMOJI[type];
}

export function formatKmRange(startKm: number, endKm: number): string {
  if (startKm === endKm) {
    return `km ${Math.round(startKm)}`;
  }
  return `km ${Math.round(startKm)}–${Math.round(endKm)}`;
}
