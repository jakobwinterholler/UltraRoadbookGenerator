import type { EvaluationSceneId } from "./mapEvaluationScenes";
import type { TargetMapStyleId } from "./mapStyleCatalog";

const STORAGE_PREFIX = "ultra-roadbook.map-style-screenshot";

function storageKey(raceKey: string, sceneId: EvaluationSceneId, styleId: TargetMapStyleId): string {
  return `${STORAGE_PREFIX}:${raceKey}:${sceneId}:${styleId}`;
}

export function readMapStyleScreenshot(
  raceKey: string,
  sceneId: EvaluationSceneId,
  styleId: TargetMapStyleId,
): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(storageKey(raceKey, sceneId, styleId));
}

export function writeMapStyleScreenshot(
  raceKey: string,
  sceneId: EvaluationSceneId,
  styleId: TargetMapStyleId,
  dataUrl: string,
): void {
  window.localStorage.setItem(storageKey(raceKey, sceneId, styleId), dataUrl);
}

export function clearMapStyleScreenshot(
  raceKey: string,
  sceneId: EvaluationSceneId,
  styleId: TargetMapStyleId,
): void {
  window.localStorage.removeItem(storageKey(raceKey, sceneId, styleId));
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const MAX_SCREENSHOT_BYTES = 1_500_000;

export function validateScreenshotFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please upload an image file (PNG or JPEG).";
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return "Image is too large — use a compressed screenshot under 1.5 MB.";
  }
  return null;
}
