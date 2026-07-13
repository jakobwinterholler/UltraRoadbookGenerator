import { useEffect, useRef, useState } from "react";
import type { EvaluationSceneId } from "./mapEvaluationScenes";
import {
  clearMapStyleScreenshot,
  fileToDataUrl,
  readMapStyleScreenshot,
  validateScreenshotFile,
  writeMapStyleScreenshot,
} from "./mapStyleScreenshotStore";
import type { TargetMapStyleDefinition } from "./mapStyleCatalog";
import type { RouteSceneViewport } from "./mapRouteViewport";

interface MapStyleReferenceCardProps {
  style: TargetMapStyleDefinition;
  raceKey: string;
  sceneId: EvaluationSceneId;
  viewport: RouteSceneViewport;
  sceneLabel: string;
}

export default function MapStyleReferenceCard({
  style,
  raceKey,
  sceneId,
  viewport,
  sceneLabel,
}: MapStyleReferenceCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [screenshot, setScreenshot] = useState<string | null>(() =>
    readMapStyleScreenshot(raceKey, sceneId, style.id),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScreenshot(readMapStyleScreenshot(raceKey, sceneId, style.id));
    setError(null);
  }, [raceKey, sceneId, style.id]);

  const previewUrl = style.previewUrl?.(viewport.lat, viewport.lon, viewport.zoom) ?? null;

  async function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const dataUrl = await fileToDataUrl(file);
    writeMapStyleScreenshot(raceKey, sceneId, style.id, dataUrl);
    setScreenshot(dataUrl);
  }

  function handleClear() {
    clearMapStyleScreenshot(raceKey, sceneId, style.id);
    setScreenshot(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line/60 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-canvas">
        {screenshot ? (
          <img
            src={screenshot}
            alt={`${style.label} reference for ${sceneLabel}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-xs font-medium text-ink">No screenshot yet</p>
            <p className="text-[11px] leading-relaxed text-muted">{style.captureHint}</p>
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-ink shadow-sm">
          {style.label}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs text-muted">{style.evaluateFor}</p>
        <p className="text-[11px] tabular-nums text-muted">
          Scene centre {viewport.lat.toFixed(4)}, {viewport.lon.toFixed(4)} · zoom ~{viewport.zoom}
        </p>

        <div className="mt-auto flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-800"
          >
            Upload screenshot
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
            >
              Open preview ↗
            </a>
          )}
          {screenshot && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </article>
  );
}
