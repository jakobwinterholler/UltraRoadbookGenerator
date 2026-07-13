/** Must match src/preview_versions.py — bump together when invalidating previews. */
export const STORY_VERSION = "1";
export const RUNTIME_VERSION = "2";
export const CAMERA_VERSION = "3";

export const PREVIEW_PIPELINE_VERSION = `story-${STORY_VERSION}-runtime-${RUNTIME_VERSION}-camera-${CAMERA_VERSION}`;

/** Frontend bundle marker for debug panel. */
export const FRONTEND_PREVIEW_BUILD_AT = import.meta.env.DEV ? "dev" : "production";

export function previewPipelineMatches(stored: string | null | undefined): boolean {
  return stored === PREVIEW_PIPELINE_VERSION;
}
