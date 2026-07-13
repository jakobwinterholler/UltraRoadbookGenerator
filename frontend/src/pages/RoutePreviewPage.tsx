import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppTab, RoadbookResult } from "../api";
import RoutePreviewDebugPanel from "../components/routePreview/RoutePreviewDebugPanel";
import RoutePreviewGeneratePanel, {
  RoutePreviewProgressPanel,
} from "../components/routePreview/RoutePreviewGeneratePanel";
import RoutePreviewErrorBoundary from "../components/routePreview/RoutePreviewErrorBoundary";
import RoutePreviewMapPlayer from "../components/routePreview/RoutePreviewMapPlayer";
import RoutePreviewViewer, {
  type RoutePreviewViewerHandle,
} from "../components/routePreview/RoutePreviewViewer";
import {
  DEFAULT_PREPARE_STEPS,
  estimateRemainingSeconds,
  formatEta,
  mergePrepareSteps,
  type PrepareStep,
} from "../components/routePreview/routePreviewPrepare";
import type { RoutePreviewRuntime } from "../routePreview/core/types";
import { PREVIEW_PIPELINE_VERSION } from "../routePreview/previewVersions";
import {
  fetchRoutePreviewRuntime,
  fetchRoutePreviewStatus,
  prepareRoutePreviewStream,
  type RoutePreviewStatus,
  type RoutePreviewStreamEvent,
} from "../races/api";
import { useRace } from "../races/RaceContext";

interface RoutePreviewPageProps {
  result: RoadbookResult;
  onNavigate: (tab: AppTab) => void;
}

type PagePhase = "checking" | "empty" | "generating" | "ready" | "error";
type PreviewMode = "map-mvp" | "classic";

function stepsFromStatus(status: RoutePreviewStatus): PrepareStep[] {
  return mergePrepareSteps(
    status.prepare.steps.map((step) => ({
      id: step.id,
      label: step.label,
      status: step.status as PrepareStep["status"],
    })),
    status.prepare.progress?.label,
  );
}

export default function RoutePreviewPage({ result, onNavigate }: RoutePreviewPageProps) {
  const { activeRace, verifiedStops } = useRace();
  const raceId = activeRace?.id ?? null;
  const viewerRef = useRef<RoutePreviewViewerHandle | null>(null);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("map-mvp");
  const [phase, setPhase] = useState<PagePhase>("checking");
  const [previewStatus, setPreviewStatus] = useState<RoutePreviewStatus | null>(null);
  const [runtime, setRuntime] = useState<RoutePreviewRuntime | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [prepareSteps, setPrepareSteps] = useState<PrepareStep[]>(DEFAULT_PREPARE_STEPS);
  const [prepareProgress, setPrepareProgress] = useState<{
    id?: string;
    current?: number;
    total?: number;
    label?: string;
  } | null>(null);
  const [prepareStartedAt, setPrepareStartedAt] = useState<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [runtimeSessionKey, setRuntimeSessionKey] = useState(0);
  const prepareInFlightRef = useRef(false);

  const trackPoints = useMemo(() => result.route.track_points, [result.route.track_points]);
  const raceName = runtime?.raceName ?? activeRace?.name ?? result.summary.route_name;
  const canUseMapMvp = trackPoints.length >= 2;

  const loadRuntime = useCallback(
    async (cacheBust?: string | number) => {
      if (!raceId) {
        return null;
      }
      try {
        const payload = (await fetchRoutePreviewRuntime(
          raceId,
          cacheBust ?? Date.now(),
        )) as RoutePreviewRuntime;
        setRuntime(payload);
        setRuntimeSessionKey((value) => value + 1);
        return payload;
      } catch {
        setRuntime(null);
        return null;
      }
    },
    [raceId],
  );

  const applyStatusPhase = useCallback(
    async (status: RoutePreviewStatus) => {
      setPreviewStatus(status);
      setPrepareError(status.prepare.error);

      if (status.prepare.status === "running") {
        setPrepareSteps(stepsFromStatus(status));
        setPrepareProgress(status.prepare.progress ?? null);
        if (!prepareStartedAt && status.prepare.started_at) {
          setPrepareStartedAt(new Date(status.prepare.started_at).getTime());
        }
        setPhase("generating");
        return;
      }

      if (prepareInFlightRef.current) {
        return;
      }

      if (status.has_runtime) {
        await loadRuntime(status.prepared_at ?? status.debug?.runtime?.generated_at ?? Date.now());
        setPhase("ready");
        return;
      }

      if (status.prepare.status === "error") {
        setPrepareSteps(stepsFromStatus(status));
        setPhase("error");
        return;
      }

      setPhase("empty");
    },
    [loadRuntime, prepareStartedAt],
  );

  const refreshStatus = useCallback(async () => {
    if (!raceId) {
      return;
    }
    const status = await fetchRoutePreviewStatus(raceId);
    await applyStatusPhase(status);
  }, [raceId, applyStatusPhase]);

  useEffect(() => {
    if (previewMode === "classic") {
      void refreshStatus();
    }
  }, [previewMode, refreshStatus]);

  useEffect(() => {
    if (phase !== "generating") {
      return;
    }
    const timer = window.setInterval(() => {
      setEtaSeconds(estimateRemainingSeconds(prepareSteps, prepareProgress, prepareStartedAt));
    }, 1000);
    setEtaSeconds(estimateRemainingSeconds(prepareSteps, prepareProgress, prepareStartedAt));
    return () => window.clearInterval(timer);
  }, [phase, prepareSteps, prepareProgress, prepareStartedAt]);

  useEffect(() => {
    if (phase !== "generating" || prepareInFlightRef.current) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [phase, refreshStatus]);

  const handleStreamEvent = useCallback((event: RoutePreviewStreamEvent) => {
    if (event.type === "step") {
      setPrepareSteps((current) => {
        const exists = current.some((step) => step.id === event.id);
        const next = exists
          ? current.map((step) =>
              step.id === event.id
                ? { ...step, label: event.label, status: event.status as PrepareStep["status"] }
                : step,
            )
          : [
              ...current,
              { id: event.id, label: event.label, status: event.status as PrepareStep["status"] },
            ];
        return mergePrepareSteps(next);
      });
    }
    if (event.type === "progress") {
      setPrepareProgress({
        id: event.id,
        current: event.current,
        total: event.total,
        label: event.label,
      });
      setPrepareSteps((current) => mergePrepareSteps(current, event.label));
    }
    if (event.type === "error") {
      setPrepareError(event.detail);
      setPhase("error");
    }
  }, []);

  const handleGenerate = useCallback(
    async (options?: { autoPlayOnComplete?: boolean }) => {
      if (!raceId || prepareInFlightRef.current) {
        return;
      }

      prepareInFlightRef.current = true;
      setIsPreparing(true);
      setPrepareError(null);
      setPrepareSteps(DEFAULT_PREPARE_STEPS.map((step) =>
        step.id === "story" ? { ...step, status: "running" } : step,
      ));
      setPrepareProgress(null);
      setPrepareStartedAt(Date.now());
      setPhase("generating");
      setRuntime(null);
      setJustGenerated(Boolean(options?.autoPlayOnComplete));
      setAutoPlay(Boolean(options?.autoPlayOnComplete));

      try {
        await prepareRoutePreviewStream(raceId, handleStreamEvent);
        const status = await fetchRoutePreviewStatus(raceId);
        setPreviewStatus(status);
        await loadRuntime(status.prepared_at ?? Date.now());
        setPhase("ready");
        if (options?.autoPlayOnComplete) {
          setAutoPlay(true);
        }
      } catch (error) {
        setPrepareError(error instanceof Error ? error.message : "Generation failed.");
        setPhase("error");
      } finally {
        prepareInFlightRef.current = false;
        setIsPreparing(false);
      }
    },
    [raceId, handleStreamEvent, loadRuntime],
  );

  const isStale =
    (previewStatus?.is_stale ?? false) ||
    (runtime?.meta?.pipelineVersion != null &&
      runtime.meta.pipelineVersion !== PREVIEW_PIPELINE_VERSION);
  const etaLabel = formatEta(etaSeconds);
  const hasClassicPreview = phase === "ready" && runtime;
  const useTileCache = (previewStatus?.has_cache ?? false) && !isStale;

  if (previewMode === "map-mvp" && canUseMapMvp) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden px-2 pb-2 pt-1.5 md:px-3">
        <header className="mb-1 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="text-sm font-medium text-muted transition hover:text-ink"
          >
            ← Back
          </button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-ink md:text-base">
            {raceName}
          </h1>
          <div className="inline-flex shrink-0 rounded-xl border border-line bg-card p-0.5 shadow-card">
            <button
              type="button"
              onClick={() => setPreviewMode("map-mvp")}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white"
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("classic")}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
            >
              Classic
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <RoutePreviewErrorBoundary label="RoutePreviewMapPlayer">
            <RoutePreviewMapPlayer
            trackPoints={trackPoints}
            distanceKm={result.summary.distance_km}
            zones={result.resupply_zones}
            verifiedStops={verifiedStops}
            climbs={result.climbs}
          />
        </RoutePreviewErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 pb-16">
      <header className="mb-8">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="mb-3 text-sm font-medium text-muted transition hover:text-ink"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{raceName}</h1>
        {canUseMapMvp ? (
          <div className="mt-4 inline-flex rounded-xl border border-line bg-card p-1 shadow-card">
            <button
              type="button"
              onClick={() => setPreviewMode("map-mvp")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                previewMode === "map-mvp"
                  ? "bg-ink text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              Map preview (MVP)
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("classic")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                previewMode === "classic"
                  ? "bg-ink text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              Classic (3D)
            </button>
          </div>
        ) : null}
      </header>

      {previewMode === "classic" ? (
        <>
          {phase === "checking" ? (
            <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              <div className="flex aspect-video items-center justify-center bg-[#050505]">
                <p className="text-sm text-white/50">Loading…</p>
              </div>
            </section>
          ) : null}

          {phase === "empty" ? (
            <RoutePreviewGeneratePanel
              raceName={raceName}
              onGenerate={() => void handleGenerate({ autoPlayOnComplete: true })}
            />
          ) : null}

          {phase === "generating" || phase === "error" ? (
            <RoutePreviewProgressPanel
              steps={prepareSteps}
              etaLabel={phase === "error" ? null : etaLabel}
              error={phase === "error" ? prepareError : null}
              onRetry={() => void handleGenerate({ autoPlayOnComplete: true })}
            />
          ) : null}

          {hasClassicPreview ? (
            <>
              <RoutePreviewViewer
                key={runtimeSessionKey}
                ref={viewerRef}
                raceId={raceId!}
                runtime={runtime}
                zones={result.resupply_zones}
                verifiedStops={verifiedStops}
                useTileCache={useTileCache}
                autoPlay={autoPlay}
                showPlayPrompt={!justGenerated}
                isStale={isStale}
                onRegenerate={() => void handleGenerate({ autoPlayOnComplete: false })}
                regenerating={isPreparing}
              />
              <RoutePreviewDebugPanel
                status={previewStatus}
                runtime={runtime}
                runtimeSessionKey={runtimeSessionKey}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
