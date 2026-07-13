import type { RoutePreviewStatus } from "../../races/api";
import type { RoutePreviewRuntime } from "../../routePreview/core/types";
import {
  CAMERA_VERSION,
  FRONTEND_PREVIEW_BUILD_AT,
  PREVIEW_PIPELINE_VERSION,
  RUNTIME_VERSION,
  STORY_VERSION,
  previewPipelineMatches,
} from "../../routePreview/previewVersions";

interface RoutePreviewDebugPanelProps {
  status: RoutePreviewStatus | null;
  runtime: RoutePreviewRuntime | null;
  runtimeSessionKey: number;
}

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

export default function RoutePreviewDebugPanel({
  status,
  runtime,
  runtimeSessionKey,
}: RoutePreviewDebugPanelProps) {
  const debug = status?.debug;
  const runtimeMeta = runtime?.meta;
  const cacheHit = status?.last_cache_hit;
  const pipelineOk = previewPipelineMatches(status?.stored_pipeline_version ?? runtimeMeta?.pipelineVersion);
  const frontendOk = previewPipelineMatches(PREVIEW_PIPELINE_VERSION);

  return (
    <details className="mt-4 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/80 text-xs text-amber-950">
      <summary className="cursor-pointer px-4 py-3 font-medium">
        Preview debug
        {status?.is_stale ? (
          <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            stale
          </span>
        ) : (
          <span className="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            current
          </span>
        )}
      </summary>
      <div className="grid gap-2 border-t border-amber-200/80 px-4 py-3 font-mono text-[11px] leading-relaxed md:grid-cols-2">
        <div>
          <p className="font-semibold text-amber-900">Versions</p>
          <p>Pipeline (current): {PREVIEW_PIPELINE_VERSION}</p>
          <p>Pipeline (stored): {formatValue(status?.stored_pipeline_version)}</p>
          <p>Pipeline (runtime file): {formatValue(runtimeMeta?.pipelineVersion)}</p>
          <p>Story: {STORY_VERSION} / file {formatValue(runtimeMeta?.storyVersion)}</p>
          <p>Runtime: {RUNTIME_VERSION} / file {formatValue(runtimeMeta?.runtimeVersion)}</p>
          <p>Camera: {CAMERA_VERSION} / file {formatValue(runtimeMeta?.cameraVersion)}</p>
          <p>Frontend build: {FRONTEND_PREVIEW_BUILD_AT}</p>
          <p>Viewer session: {runtimeSessionKey}</p>
        </div>
        <div>
          <p className="font-semibold text-amber-900">Generation</p>
          <p>Last generated: {formatValue(status?.prepared_at ?? runtimeMeta?.generatedAt)}</p>
          <p>Runtime mtime: {formatValue(debug?.runtime?.file_mtime)}</p>
          <p>Source fingerprint: {formatValue(status?.source_fingerprint)}</p>
          <p>Stored fingerprint: {formatValue(status?.stored_source_fingerprint)}</p>
          <p>Last terrain cache: {cacheHit === null || cacheHit === undefined ? "—" : cacheHit ? "hit" : "miss"}</p>
          <p>Cache segment hash: {formatValue(debug?.cache?.segment_hash)}</p>
          <p>Cache updated: {formatValue(debug?.cache?.updated_at)}</p>
          <p>Pipeline match: {pipelineOk && frontendOk ? "yes" : "NO"}</p>
        </div>
        {status?.stale_reasons?.length ? (
          <div className="md:col-span-2">
            <p className="font-semibold text-amber-900">Stale reasons</p>
            <ul className="list-disc pl-4">
              {status.stale_reasons.map((reason: string) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
