import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ClimbRow, ResupplyZone, TrackPoint } from "../../api";
import { analyzeClimbs, selectKeyClimbs, type AnalyzedClimb } from "../../planning/climbAnalysis";
import type { VerifiedStopRecord } from "../../planning/stopVerification/types";
import RoutePreviewClimbPanel from "./RoutePreviewClimbPanel";
import RoutePreviewElevationStrip from "./RoutePreviewElevationStrip";
import RoutePreviewMinimap from "./RoutePreviewMinimap";
import { removeVerifiedStopLayers, syncVerifiedStopLayers } from "./routePreviewMarkers";
import {
  MAP_PREVIEW_STYLE_URL,
  ROUTE_HALO_PAINT,
  ROUTE_LAYER_PAINT,
  flyoverDurationS,
  smoothFlyoverSample,
  type FlyoverSample,
} from "../../routePreview/mapFlyover";
import {
  applyNavigationCamera,
  flyoverSampleToCamera,
} from "../../routePreview/mapNavigationCamera";
import {
  activeKeyClimbAtKm,
  buildPlaybackPaceTable,
  elapsedAtProgress,
  progressAtElapsed,
} from "../../routePreview/playbackPacing";
import {
  buildSmoothedPlaybackPath,
  samplePlaybackAtProgress,
  type SmoothedPlaybackPath,
} from "../../routePreview/playbackPathSmoothing";
import {
  buildVerifiedStopMarkers,
  setMapInteractionLocked,
  type RoutePreviewVerifiedStop,
} from "../../routePreview/routePreviewHud";
import { formatRouteKm } from "../../routePreview/formatRouteKm";

interface RoutePreviewMapPlayerProps {
  trackPoints: TrackPoint[];
  distanceKm: number;
  zones: ResupplyZone[];
  verifiedStops: Record<string, VerifiedStopRecord>;
  climbs: ClimbRow[];
}

type ViewMode = "navigation" | "overview";

const SMOOTH_ALPHA = 0.16;
const MAX_FRAME_DELTA_S = 0.05;
const STOP_TOAST_MS = 3200;
const STOP_APPROACH_KM = 0.35;
const CLIMB_PANEL_MS = 9000;

function endpointMarker(label: string, color: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className =
    "flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white px-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-md";
  element.style.backgroundColor = color;
  element.textContent = label;
  return element;
}

function addRouteLayers(map: maplibregl.Map, routeCoordinates: [number, number][]): void {
  if (map.getSource("route")) {
    (map.getSource("route") as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
    });
    return;
  }

  map.addSource("route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
    },
  });

  map.addLayer({
    id: "route-halo",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ROUTE_HALO_PAINT.lineColor,
      "line-width": ROUTE_HALO_PAINT.lineWidth,
      "line-opacity": ROUTE_HALO_PAINT.lineOpacity,
    },
  });

  map.addLayer({
    id: "route-core",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ROUTE_LAYER_PAINT.lineColor,
      "line-width": ROUTE_LAYER_PAINT.lineWidth,
      "line-opacity": ROUTE_LAYER_PAINT.lineOpacity,
    },
  });
}

export default function RoutePreviewMapPlayer({
  trackPoints,
  distanceKm,
  zones,
  verifiedStops,
  climbs,
}: RoutePreviewMapPlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const endpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const elapsedRef = useRef(0);
  const playingRef = useRef(false);
  const lastKmRef = useRef(0);
  const smoothedSampleRef = useRef<FlyoverSample | null>(null);
  const announcedStopsRef = useRef<Set<number>>(new Set());
  const announcedClimbsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const climbPanelTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("navigation");
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentKm, setCurrentKm] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [playbackBearing, setPlaybackBearing] = useState(0);
  const [stopToast, setStopToast] = useState<RoutePreviewVerifiedStop | null>(null);
  const [climbPanel, setClimbPanel] = useState<{ climb: AnalyzedClimb; visible: boolean } | null>(
    null,
  );

  const playbackPath = useMemo(
    () => buildSmoothedPlaybackPath(trackPoints),
    [trackPoints],
  );

  const routeCoordinates = playbackPath.coordinates;

  const verifiedStopMarkers = useMemo(
    () => buildVerifiedStopMarkers(zones, verifiedStops),
    [zones, verifiedStops],
  );

  const keyClimbs = useMemo(
    () => selectKeyClimbs(analyzeClimbs(climbs)),
    [climbs],
  );

  const totalKm = useMemo(
    () => playbackPath.totalKm || trackPoints[trackPoints.length - 1]?.km || distanceKm,
    [distanceKm, playbackPath.totalKm, trackPoints],
  );

  const totalDurationS = flyoverDurationS(totalKm);

  const paceTable = useMemo(
    () => buildPlaybackPaceTable(trackPoints, totalKm, totalDurationS, keyClimbs),
    [keyClimbs, totalDurationS, totalKm, trackPoints],
  );

  const activeClimb = useMemo(
    () => activeKeyClimbAtKm(currentKm, keyClimbs),
    [currentKm, keyClimbs],
  );

  const clearStopToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearClimbPanelTimer = useCallback(() => {
    if (climbPanelTimerRef.current !== null) {
      window.clearTimeout(climbPanelTimerRef.current);
      climbPanelTimerRef.current = null;
    }
  }, []);

  const showStopToast = useCallback(
    (stop: RoutePreviewVerifiedStop) => {
      clearStopToastTimer();
      setStopToast(stop);
      toastTimerRef.current = window.setTimeout(() => {
        setStopToast(null);
        toastTimerRef.current = null;
      }, STOP_TOAST_MS);
    },
    [clearStopToastTimer],
  );

  const showClimbPanel = useCallback(
    (climb: AnalyzedClimb) => {
      clearClimbPanelTimer();
      setClimbPanel({ climb, visible: true });
      climbPanelTimerRef.current = window.setTimeout(() => {
        setClimbPanel((current) =>
          current?.climb.id === climb.id ? { ...current, visible: false } : current,
        );
        climbPanelTimerRef.current = null;
      }, CLIMB_PANEL_MS);
    },
    [clearClimbPanelTimer],
  );

  const resetAnnouncedFromKm = useCallback(
    (fromKm: number) => {
      for (const stop of verifiedStopMarkers) {
        if (stop.km >= fromKm - STOP_APPROACH_KM) {
          announcedStopsRef.current.delete(stop.zoneId);
        }
      }
      for (const climb of keyClimbs) {
        if (climb.start_km >= fromKm - 0.2) {
          announcedClimbsRef.current.delete(climb.id);
        }
      }
    },
    [keyClimbs, verifiedStopMarkers],
  );

  const checkStopCrossings = useCallback(
    (km: number, previousKm: number, whilePlaying: boolean) => {
      if (!whilePlaying || km <= previousKm) {
        return;
      }
      for (const stop of verifiedStopMarkers) {
        if (
          !announcedStopsRef.current.has(stop.zoneId) &&
          previousKm < stop.km - STOP_APPROACH_KM &&
          km >= stop.km - STOP_APPROACH_KM
        ) {
          announcedStopsRef.current.add(stop.zoneId);
          showStopToast(stop);
        }
      }
    },
    [showStopToast, verifiedStopMarkers],
  );

  const checkClimbEntries = useCallback(
    (km: number, previousKm: number, whilePlaying: boolean) => {
      if (!whilePlaying || km <= previousKm) {
        return;
      }
      for (const climb of keyClimbs) {
        if (
          !announcedClimbsRef.current.has(climb.id) &&
          previousKm < climb.start_km &&
          km >= climb.start_km
        ) {
          announcedClimbsRef.current.add(climb.id);
          showClimbPanel(climb);
        }
      }
    },
    [keyClimbs, showClimbPanel],
  );

  const clearEndpointMarkers = useCallback(() => {
    for (const marker of endpointMarkersRef.current) {
      marker.remove();
    }
    endpointMarkersRef.current = [];
  }, []);

  const syncVerifiedStopsOnMap = useCallback(
    (map: maplibregl.Map) => {
      syncVerifiedStopLayers(map, verifiedStopMarkers);
    },
    [verifiedStopMarkers],
  );

  const applyNavigationAtProgress = useCallback(
    (map: maplibregl.Map, path: SmoothedPlaybackPath, nextProgress: number, resetSmoothing: boolean) => {
      if (resetSmoothing) {
        smoothedSampleRef.current = null;
      }
      const raw = samplePlaybackAtProgress(path, nextProgress);
      const smoothed = smoothFlyoverSample(smoothedSampleRef.current, raw, SMOOTH_ALPHA);
      const frame: FlyoverSample = { ...smoothed, bearing: raw.bearing };
      smoothedSampleRef.current = frame;
      applyNavigationCamera(map, flyoverSampleToCamera(frame));
      return frame;
    },
    [],
  );

  const showOverview = useCallback(
    (map: maplibregl.Map) => {
      clearEndpointMarkers();
      setMapInteractionLocked(map, false);
      const bounds = routeCoordinates.reduce(
        (box, coord) => box.extend(coord),
        new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]),
      );
      map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 14 });

      const start = routeCoordinates[0];
      const finish = routeCoordinates[routeCoordinates.length - 1];
      endpointMarkersRef.current = [
        new maplibregl.Marker({ element: endpointMarker("Start", "#16A34A"), anchor: "center" })
          .setLngLat(start)
          .addTo(map),
        new maplibregl.Marker({ element: endpointMarker("Finish", "#DC2626"), anchor: "center" })
          .setLngLat(finish)
          .addTo(map),
      ];
    },
    [clearEndpointMarkers, routeCoordinates],
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameAtRef.current = null;
  }, []);

  const renderAtProgress = useCallback(
    (nextProgress: number, resetSmoothing = false, whilePlaying = playingRef.current) => {
      const clamped = Math.min(1, Math.max(0, nextProgress));
      progressRef.current = clamped;
      setProgress(clamped);

      const map = mapRef.current;
      let km = samplePlaybackAtProgress(playbackPath, clamped).km;

      if (map && viewMode === "navigation") {
        const smoothed = applyNavigationAtProgress(map, playbackPath, clamped, resetSmoothing);
        km = smoothed.km;
        setPlaybackPosition({ lat: smoothed.lat, lon: smoothed.lng });
        setPlaybackBearing(smoothed.bearing);
      }

      checkStopCrossings(km, lastKmRef.current, whilePlaying);
      checkClimbEntries(km, lastKmRef.current, whilePlaying);
      lastKmRef.current = km;
      setCurrentKm(km);

      if (clamped >= 1 && playingRef.current) {
        playingRef.current = false;
        setIsPlaying(false);
        stopLoop();
      }
    },
    [
      applyNavigationAtProgress,
      checkClimbEntries,
      checkStopCrossings,
      playbackPath,
      stopLoop,
      viewMode,
    ],
  );

  const tick = useCallback(
    (frameAt: number) => {
      if (!playingRef.current) {
        return;
      }
      const last = lastFrameAtRef.current ?? frameAt;
      const deltaS = Math.min(MAX_FRAME_DELTA_S, (frameAt - last) / 1000);
      lastFrameAtRef.current = frameAt;
      elapsedRef.current = Math.min(totalDurationS, elapsedRef.current + deltaS);
      const nextProgress = progressAtElapsed(paceTable, elapsedRef.current);
      renderAtProgress(nextProgress, false, true);

      if (playingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [paceTable, renderAtProgress, totalDurationS],
  );

  const play = useCallback(() => {
    if (viewMode !== "navigation") {
      setViewMode("navigation");
    }
    if (progressRef.current >= 1) {
      announcedStopsRef.current.clear();
      announcedClimbsRef.current.clear();
      elapsedRef.current = 0;
      lastKmRef.current = 0;
      renderAtProgress(0, true, false);
    }
    playingRef.current = true;
    setIsPlaying(true);
    stopLoop();
    rafRef.current = requestAnimationFrame(tick);
  }, [renderAtProgress, stopLoop, tick, viewMode]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    stopLoop();
  }, [stopLoop]);

  const seek = useCallback(
    (nextProgress: number) => {
      pause();
      const seekKm = samplePlaybackAtProgress(playbackPath, nextProgress).km;
      resetAnnouncedFromKm(seekKm);
      elapsedRef.current = elapsedAtProgress(paceTable, nextProgress);
      lastKmRef.current = seekKm;
      renderAtProgress(nextProgress, true, false);
    },
    [pause, paceTable, playbackPath, renderAtProgress, resetAnnouncedFromKm],
  );

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }
    if (!document.fullscreenElement) {
      void shell.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || routeCoordinates.length < 2) {
      return;
    }

    let cancelled = false;

    const map = new maplibregl.Map({
      container: host,
      style: MAP_PREVIEW_STYLE_URL,
      center: routeCoordinates[0],
      zoom: 4,
      pitch: 0,
      bearing: 0,
    });
    mapRef.current = map;

    const setupMap = () => {
      if (cancelled) {
        return;
      }

      try {
        addRouteLayers(map, routeCoordinates);
        syncVerifiedStopsOnMap(map);
        setMapInteractionLocked(map, true);
        applyNavigationAtProgress(map, playbackPath, 0, true);
        const start = samplePlaybackAtProgress(playbackPath, 0);
        setPlaybackPosition({ lat: start.lat, lon: start.lng });
        setPlaybackBearing(start.bearing);
        lastKmRef.current = 0;
        elapsedRef.current = 0;
        setCurrentKm(0);
        setStatus("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to set up route on map.");
        setStatus("error");
      }
    };

    map.on("error", (event) => {
      if (cancelled) {
        return;
      }
      setErrorMessage(event.error?.message ?? "Map failed to load.");
      setStatus("error");
    });

    if (map.loaded()) {
      setupMap();
    } else {
      map.once("load", setupMap);
    }

    return () => {
      cancelled = true;
      stopLoop();
      clearStopToastTimer();
      clearClimbPanelTimer();
      clearEndpointMarkers();
      removeVerifiedStopLayers(map);
      map.remove();
      mapRef.current = null;
    };
  }, [
    applyNavigationAtProgress,
    clearClimbPanelTimer,
    clearEndpointMarkers,
    clearStopToastTimer,
    playbackPath,
    routeCoordinates,
    stopLoop,
    syncVerifiedStopsOnMap,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") {
      return;
    }
    syncVerifiedStopsOnMap(map);
  }, [status, syncVerifiedStopsOnMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") {
      return;
    }

    pause();

    if (viewMode === "overview") {
      showOverview(map);
      return;
    }

    clearEndpointMarkers();
    setMapInteractionLocked(map, true);
    applyNavigationAtProgress(map, playbackPath, progressRef.current, true);
  }, [
    applyNavigationAtProgress,
    clearEndpointMarkers,
    pause,
    playbackPath,
    showOverview,
    status,
    viewMode,
  ]);

  if (routeCoordinates.length < 2) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-card p-8 text-center text-sm text-muted shadow-card">
        Route track is not available yet. Analyze this race first.
      </section>
    );
  }

  return (
    <div
      ref={shellRef}
      className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-2xl border border-line bg-[#050505] shadow-card"
    >
      <div className="relative min-h-0">
        <div
          ref={hostRef}
          className={`absolute inset-0 ${viewMode === "navigation" ? "pointer-events-none" : ""}`}
        />
        {status === "ready" ? (
          <div className="pointer-events-auto absolute left-1/2 top-3 z-20 -translate-x-1/2">
            <div className="inline-flex rounded-lg border border-white/15 bg-black/55 p-0.5 shadow-lg backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setViewMode("navigation")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  viewMode === "navigation"
                    ? "bg-white text-black"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Replay
              </button>
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  viewMode === "overview"
                    ? "bg-white text-black"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Full route
              </button>
            </div>
          </div>
        ) : null}
        {viewMode === "navigation" && status === "ready" ? (
          <>
            <RoutePreviewMinimap
              trackPoints={trackPoints}
              currentKm={currentKm}
              totalKm={totalKm}
              verifiedStops={verifiedStopMarkers}
              playbackPosition={playbackPosition}
              playbackBearing={playbackBearing}
              playbackRoutePoints={playbackPath.points}
            />
            {climbPanel ? (
              <RoutePreviewClimbPanel climb={climbPanel.climb} visible={climbPanel.visible} />
            ) : null}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              aria-hidden
            >
              <div className="h-4 w-4 rounded-full border-2 border-white bg-[#6D28D9] shadow-lg ring-4 ring-[#6D28D9]/25" />
            </div>
            {stopToast ? (
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-300">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-sm text-white shadow-lg backdrop-blur-sm">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                    ✓
                  </span>
                  <span className="max-w-[14rem] truncate">{stopToast.label}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {status === "loading" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/90">
            <p className="text-sm text-white/70">Loading map…</p>
          </div>
        ) : null}
        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/90 px-6 text-center">
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        ) : null}
        {viewMode === "navigation" && status === "ready" && !isPlaying ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
            <button
              type="button"
              onClick={play}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black shadow-xl transition hover:scale-105 hover:bg-white/95"
              aria-label="Play route replay"
            >
              ▶
            </button>
          </div>
        ) : null}
      </div>

      {viewMode === "navigation" && status === "ready" ? (
        <>
          <div className="flex items-center gap-2 border-t border-white/10 bg-[#0a0a0a] px-2 py-1.5 md:px-3">
            {isPlaying ? (
              <button
                type="button"
                onClick={pause}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs text-black transition hover:bg-white/90"
                aria-label="Pause"
              >
                ⏸
              </button>
            ) : (
              <button
                type="button"
                onClick={play}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs text-black transition hover:bg-white/90"
                aria-label="Play"
              >
                ▶
              </button>
            )}
            <input
              type="range"
              min={0}
              max={1}
              step={0.0005}
              value={progress}
              onChange={(event) => seek(Number(event.target.value))}
              className="min-w-0 flex-1 accent-white"
              aria-label="Timeline"
            />
            <p className="shrink-0 text-[11px] tabular-nums text-white/65">
              {formatRouteKm(currentKm)} / {formatRouteKm(totalKm)}
            </p>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs text-white/80 transition hover:bg-white/10"
              aria-label="Fullscreen"
            >
              ⛶
            </button>
          </div>
          <RoutePreviewElevationStrip
            trackPoints={trackPoints}
            currentKm={currentKm}
            totalKm={totalKm}
            verifiedStops={verifiedStopMarkers}
            activeClimb={
              activeClimb
                ? { startKm: activeClimb.start_km, endKm: activeClimb.end_km }
                : null
            }
          />
        </>
      ) : null}
    </div>
  );
}
