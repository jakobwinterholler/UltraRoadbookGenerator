import { useMemo, useState } from "react";
import type { ClimbRow, ResupplyZone, RouteVisualization } from "../../api";
import type { OverlayMode } from "../../planning/types";
import MapStyleEvaluationMap from "./MapStyleEvaluationMap";
import MapStyleReferenceCard from "./MapStyleReferenceCard";
import {
  EVALUATION_SCENE_PRESETS,
  resolveEvaluationSceneRange,
  type EvaluationSceneId,
} from "./mapEvaluationScenes";
import { viewportForScene } from "./mapRouteViewport";
import {
  FREE_LIVE_MAP_STYLES,
  openTopoMapUrl,
  readStoredFreeLiveStyleId,
  TARGET_MAP_STYLES,
  writeStoredFreeLiveStyleId,
  type FreeLiveMapStyleId,
} from "./mapStyleCatalog";

interface MapStyleEvaluationProps {
  route: RouteVisualization;
  zones: ResupplyZone[];
  climbs: ClimbRow[];
  raceName?: string;
  raceKey?: string;
}

export default function MapStyleEvaluation({
  route,
  zones,
  climbs,
  raceName,
  raceKey = "default",
}: MapStyleEvaluationProps) {
  const [liveStyleId, setLiveStyleId] = useState<FreeLiveMapStyleId>(() =>
    readStoredFreeLiveStyleId(),
  );
  const [sceneId, setSceneId] = useState<EvaluationSceneId>("mountain");
  const [overlay, setOverlay] = useState<OverlayMode>("normal");
  const [showZones, setShowZones] = useState(true);
  const [showClimbs, setShowClimbs] = useState(true);
  const [customStartKm, setCustomStartKm] = useState("");
  const [customEndKm, setCustomEndKm] = useState("");

  const totalKm = route.track_points[route.track_points.length - 1]?.km ?? 0;

  const sceneRange = useMemo(() => {
    const customRange =
      sceneId === "custom" && customStartKm && customEndKm
        ? { startKm: Number(customStartKm), endKm: Number(customEndKm) }
        : null;

    return (
      resolveEvaluationSceneRange(route, climbs, zones, sceneId, customRange) ?? {
        startKm: 0,
        endKm: totalKm,
        label: "Full route",
        detail: `${Math.round(totalKm)} km total`,
      }
    );
  }, [climbs, customEndKm, customStartKm, route, sceneId, totalKm, zones]);

  const viewport = useMemo(
    () => viewportForScene(route, sceneRange.startKm, sceneRange.endKm),
    [route, sceneRange.endKm, sceneRange.startKm],
  );

  const activeLiveStyle = FREE_LIVE_MAP_STYLES.find((style) => style.id === liveStyleId)!;

  function handleLiveStyleChange(nextStyleId: FreeLiveMapStyleId) {
    setLiveStyleId(nextStyleId);
    writeStoredFreeLiveStyleId(nextStyleId);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-dashed border-purple-300/70 bg-purple-50/40 p-4 sm:p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">Map style evaluation</h3>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
            Developer
          </span>
        </div>
        <p className="text-sm text-muted">
          Choose a visual direction before any API keys or billing. Compare target styles via
          screenshots on {raceName ? `"${raceName}"` : "the open race"}, then explore free live
          proxies with your route overlays.
        </p>
      </div>

      <SceneControls
        sceneId={sceneId}
        setSceneId={setSceneId}
        totalKm={totalKm}
        customStartKm={customStartKm}
        customEndKm={customEndKm}
        setCustomStartKm={setCustomStartKm}
        setCustomEndKm={setCustomEndKm}
        sceneRange={sceneRange}
        viewport={viewport}
      />

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-ink">Target styles — screenshot comparison</h4>
          <p className="mt-1 text-xs text-muted">
            Capture the same scene from each provider’s preview (no API keys). Upload screenshots
            here to compare aesthetics side by side. Screenshots are stored locally in your browser.
          </p>
        </div>
        <ol className="list-decimal space-y-1 pl-4 text-[11px] text-muted">
          <li>Select a scene below (e.g. Mountainous for The Capitals).</li>
          <li>Open each provider preview — coordinates and zoom are shown on every card.</li>
          <li>Screenshot the same area and upload. Repeat for flat and urban scenes on other races.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TARGET_MAP_STYLES.map((style) => (
            <MapStyleReferenceCard
              key={`${style.id}-${sceneId}`}
              style={style}
              raceKey={raceKey}
              sceneId={sceneId}
              viewport={viewport}
              sceneLabel={sceneRange.label}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-purple-200/80 pt-5">
        <div>
          <h4 className="text-sm font-semibold text-ink">Live exploration — free basemaps</h4>
          <p className="mt-1 text-xs text-muted">
            Directional proxies on your real route with purple route glow and overlays. Not identical
            to the target styles above, but useful for immediate terrain/vegetation feel.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              {FREE_LIVE_MAP_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleLiveStyleChange(style.id)}
                  className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    liveStyleId === style.id
                      ? "border-purple-500 bg-white shadow-sm"
                      : "border-line/60 bg-white/80 hover:border-purple-300"
                  }`}
                >
                  <span className="block text-sm font-medium text-ink">{style.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{style.description}</span>
                  <span className="mt-1 block text-[10px] text-purple-700">Proxy for: {style.proxyFor}</span>
                </button>
              ))}
            </div>

            <OverlayControls
              overlay={overlay}
              setOverlay={setOverlay}
              showZones={showZones}
              setShowZones={setShowZones}
              showClimbs={showClimbs}
              setShowClimbs={setShowClimbs}
            />

            <a
              href={openTopoMapUrl(viewport.lat, viewport.lon, viewport.zoom)}
              target="_blank"
              rel="noreferrer"
              className="block text-xs font-medium text-accent hover:underline"
            >
              Open this scene in OpenTopoMap ↗
            </a>
          </div>

          <div>
            <MapStyleEvaluationMap
              route={route}
              zones={zones}
              climbs={climbs}
              styleId={liveStyleId}
              overlay={overlay}
              sceneRange={sceneRange}
              showZones={showZones}
              showClimbs={showClimbs}
            />
            <p className="mt-2 text-xs text-muted">
              Live: <span className="font-medium text-ink">{activeLiveStyle.label}</span> — no CSS
              filters applied.
            </p>
          </div>
        </div>
      </div>

      <EvaluationChecklist />
    </section>
  );
}

function SceneControls({
  sceneId,
  setSceneId,
  totalKm,
  customStartKm,
  customEndKm,
  setCustomStartKm,
  setCustomEndKm,
  sceneRange,
  viewport,
}: {
  sceneId: EvaluationSceneId;
  setSceneId: (id: EvaluationSceneId) => void;
  totalKm: number;
  customStartKm: string;
  customEndKm: string;
  setCustomStartKm: (value: string) => void;
  setCustomEndKm: (value: string) => void;
  sceneRange: { label: string; detail: string };
  viewport: { lat: number; lon: number; zoom: number };
}) {
  return (
    <div className="rounded-xl border border-line/50 bg-white/80 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Scene</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EVALUATION_SCENE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.hint}
            onClick={() => setSceneId(preset.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              sceneId === preset.id
                ? "bg-purple-700 text-white"
                : "bg-white text-ink ring-1 ring-line/60 hover:ring-purple-300"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {sceneRange.label} · {sceneRange.detail}
      </p>
      <p className="mt-1 text-[11px] tabular-nums text-muted">
        Centre {viewport.lat.toFixed(4)}, {viewport.lon.toFixed(4)} · zoom ~{viewport.zoom}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-muted">
          From km
          <input
            type="number"
            min={0}
            max={totalKm}
            step={1}
            value={customStartKm}
            onChange={(event) => {
              setCustomStartKm(event.target.value);
              setSceneId("custom");
            }}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="block text-[11px] text-muted">
          To km
          <input
            type="number"
            min={0}
            max={totalKm}
            step={1}
            value={customEndKm}
            onChange={(event) => {
              setCustomEndKm(event.target.value);
              setSceneId("custom");
            }}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
          />
        </label>
      </div>
    </div>
  );
}

function OverlayControls({
  overlay,
  setOverlay,
  showZones,
  setShowZones,
  showClimbs,
  setShowClimbs,
}: {
  overlay: OverlayMode;
  setOverlay: (mode: OverlayMode) => void;
  showZones: boolean;
  setShowZones: (value: boolean) => void;
  showClimbs: boolean;
  setShowClimbs: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-line/40 bg-white/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Overlays</p>
      <label className="block text-xs text-muted">
        Route mode
        <select
          value={overlay}
          onChange={(event) => setOverlay(event.target.value as OverlayMode)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
        >
          <option value="normal">Route only (purple glow)</option>
          <option value="resupply">Resupply gaps</option>
          <option value="surface">Surface types</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={showZones}
          onChange={(event) => setShowZones(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-line text-accent"
        />
        Resupply zone markers
      </label>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={showClimbs}
          onChange={(event) => setShowClimbs(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-line text-accent"
        />
        Climb highlights (orange)
      </label>
    </div>
  );
}

function EvaluationChecklist() {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2.5 text-xs text-muted">
      <p className="font-medium text-ink">Evaluation checklist</p>
      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
        <li>🌲 Forests readable at a glance?</li>
        <li>⛰ Mountains and valleys feel natural?</li>
        <li>🟣 Route stays the hero?</li>
        <li>🏘 Towns understandable quickly?</li>
        <li>✨ Feels premium, not like a road atlas?</li>
        <li>🎨 Overlays still legible?</li>
      </ul>
    </div>
  );
}
