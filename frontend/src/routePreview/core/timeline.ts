import type { RoutePreviewRuntime, RoutePreviewTimelineEntry } from "./types";

export function buildTimelineFromScenes(
  scenes: RoutePreviewRuntime["scenes"],
): RoutePreviewTimelineEntry[] {
  let cursor = 0;
  const timeline: RoutePreviewTimelineEntry[] = [];

  for (const scene of scenes) {
    const startS = cursor;
    const endS = startS + scene.screenTimeS;
    timeline.push({
      sceneId: scene.id,
      sceneOrder: scene.order,
      sceneType: scene.type,
      title: scene.title,
      startS,
      endS,
      transitionAfterS: scene.transitionAfterS,
      kmRange: scene.kmRange,
    });
    cursor = endS + scene.transitionAfterS;
  }

  return timeline;
}

export function totalDurationFromTimeline(timeline: RoutePreviewTimelineEntry[]): number {
  if (timeline.length === 0) {
    return 0;
  }
  const last = timeline[timeline.length - 1];
  return last.endS + last.transitionAfterS;
}

export function sceneIndexAtTime(
  timeline: RoutePreviewTimelineEntry[],
  timeS: number,
): number {
  if (timeline.length === 0) {
    return 0;
  }

  for (let index = 0; index < timeline.length; index += 1) {
    const entry = timeline[index];
    const next = timeline[index + 1];
    const segmentEnd = next ? next.startS : entry.endS + entry.transitionAfterS;
    if (timeS < segmentEnd) {
      return index;
    }
  }

  return timeline.length - 1;
}

export function sceneAtTime(
  timeline: RoutePreviewTimelineEntry[],
  timeS: number,
): RoutePreviewTimelineEntry {
  return timeline[sceneIndexAtTime(timeline, timeS)] ?? timeline[0];
}

export function localSceneProgress(
  entry: RoutePreviewTimelineEntry,
  timeS: number,
): number {
  if (timeS <= entry.startS) {
    return 0;
  }
  if (timeS >= entry.endS) {
    return 1;
  }
  return (timeS - entry.startS) / Math.max(0.001, entry.endS - entry.startS);
}

export function seekTimeForScene(
  timeline: RoutePreviewTimelineEntry[],
  sceneId: string,
): number {
  const entry = timeline.find((item) => item.sceneId === sceneId);
  return entry?.startS ?? 0;
}

export function nextSceneIndex(currentIndex: number, timelineLength: number): number {
  return Math.min(timelineLength - 1, currentIndex + 1);
}

export function previousSceneIndex(currentIndex: number): number {
  return Math.max(0, currentIndex - 1);
}

export function replayEndTime(entry: RoutePreviewTimelineEntry): number {
  return entry.endS;
}
