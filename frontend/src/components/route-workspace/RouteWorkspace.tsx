import { useMemo, useEffect, useCallback, useState } from "react";
import type { RoadbookResult } from "../../api";
import { useRenderTrace } from "../../debug/raceOpenTrace";
import { usePlanning } from "../../planning/PlanningContext";
import { buildRouteHighlights } from "../../planning/routeHighlights";
import type { RouteHighlight } from "../../planning/routeHighlights";
import { applyBriefingHighlight } from "../../planning/briefingActions";
import { buildResupplyGapInsights } from "../../planning/resupplyGaps";
import {
  buildResupplySegmentSummary,
  kmRangeFromSegment,
  resolveResupplySegmentEndingAtZone,
} from "../../planning/resupplySegments";
import { layersForOverlay } from "../../planning/timelineLayers";
import { useRouteWorkspaceSelection } from "../../planning/useRouteWorkspaceSelection";
import { presentZones } from "../../planning/zonePresentation";
import { useRace } from "../../races/RaceContext";
import { findNearestTrackIndex } from "../routeUtils";
import ElevationProfile from "../ElevationProfile";
import MultiLayerTimeline from "../MultiLayerTimeline";
import RouteInspector from "../RouteInspector";
import RouteMap from "../RouteMap";
import TimelineLayerControls from "../TimelineLayerControls";
import PlanningDetailSheet from "../planning/PlanningDetailSheet";
import PoiDebugPanel from "../planning/PoiDebugPanel";
import ClimbDebugPanel from "../planning/ClimbDebugPanel";
import ResupplyHubDetailContent from "../resupply/ResupplyHubDetailContent";
import { nearbyPoiDebugEntries } from "../../planning/poiDebug";
import { buildClimbDebugContext } from "../../planning/climbDebug";
import { significantClimbs } from "@shared/race/significantClimbs";
import { activePoint, computeRouteInsights, percentOfRoute } from "../routeInsights";
import { formatKm } from "../routeInsights";
import ClimbDetailView from "../climb/ClimbDetailView";
import RoutePlanningInsight from "./RoutePlanningInsight";
import { usePlanningAssumptions } from "../../planning/usePlanningAssumptions";
import RouteExplorationBar from "./RouteExplorationBar";
import RouteStopsBrowseSheet from "./RouteStopsBrowseSheet";
import CandidateContextSummary from "./CandidateContextSummary";
import ResupplySegmentSummary from "./ResupplySegmentSummary";

interface RouteWorkspaceProps {
  result: RoadbookResult;
  onViewFullBriefing: () => void;
}

export default function RouteWorkspace({ result, onViewFullBriefing }: RouteWorkspaceProps) {
  useRenderTrace("render.route.start", "render.route.done");
  const {
    overlay,
    setOverlay,
    timeMode,
    zoneDensity,
    timelineLayers,
    selectedSurfaceType,
    setSelectedSurfaceType,
    planningIntent,
    consumePlanningIntent,
  } = usePlanning();
  const { stageSettings, arrivalTimeWindow } = usePlanningAssumptions();
  const { verifiedStops } = useRace();
  const [stopsBrowseOpen, setStopsBrowseOpen] = useState(false);
  const [poiDebugMode, setPoiDebugMode] = useState(false);
  const [climbDebugMode, setClimbDebugMode] = useState(false);
  const [poiDebugClick, setPoiDebugClick] = useState<{ lat: number; lon: number } | null>(null);
  const [poiDebugSelection, setPoiDebugSelection] = useState<import("../../api").PoiDebugRow | null>(
    null,
  );
  const [climbDebugClick, setClimbDebugClick] = useState<{ lat: number; lon: number } | null>(null);

  const presentedZones = useMemo(
    () =>
      presentZones(
        result.resupply_zones,
        timeMode,
        zoneDensity,
        result.summary.distance_km,
        result.route,
      ),
    [result.resupply_zones, timeMode, zoneDensity, result.summary.distance_km, result.route],
  );

  const sortedClimbs = useMemo(
    () => significantClimbs([...result.climbs]).sort((left, right) => left.start_km - right.start_km),
    [result.climbs],
  );

  const poiDebugNearby = useMemo(() => {
    if (!poiDebugClick) {
      return [];
    }
    return nearbyPoiDebugEntries(result.poi_debug ?? [], poiDebugClick.lat, poiDebugClick.lon);
  }, [poiDebugClick, result.poi_debug]);

  const climbDebugContext = useMemo(() => {
    if (!climbDebugClick) {
      return null;
    }
    return buildClimbDebugContext(
      result.route.track_points,
      result.climbs,
      result.climb_candidates ?? [],
      climbDebugClick.lat,
      climbDebugClick.lon,
    );
  }, [climbDebugClick, result.climb_candidates, result.climbs, result.route.track_points]);

  const selection = useRouteWorkspaceSelection(result, presentedZones, verifiedStops);

  const hoverHighlightKmRange = useMemo(() => {
    if (selection.hoveredZoneId === null) {
      return null;
    }
    const zone = presentedZones.find((item) => item.zone_id === selection.hoveredZoneId);
    if (!zone) {
      return null;
    }
    return kmRangeFromSegment(
      resolveResupplySegmentEndingAtZone(zone, presentedZones, verifiedStops),
    );
  }, [selection.hoveredZoneId, presentedZones, verifiedStops]);

  const highlightKmRange = selection.kmRange ?? hoverHighlightKmRange;

  const activeSegmentSummary = useMemo(() => {
    if (!selection.kmRange) {
      return null;
    }
    const endZone =
      presentedZones.find((zone) => Math.abs(zone.distance_along_km - selection.kmRange!.endKm) < 0.05) ??
      presentedZones.find((zone) => zone.zone_id === selection.selectedZoneId) ??
      null;
    const segment = endZone
      ? resolveResupplySegmentEndingAtZone(endZone, presentedZones, verifiedStops)
      : {
          startKm: selection.kmRange.startKm,
          endKm: selection.kmRange.endKm,
          label: selection.kmRange.label,
          endZoneId: -1,
          endZoneName: selection.kmRange.label,
          startZoneName: null,
        };
    return buildResupplySegmentSummary(segment, result.route, result.resupply_zones, verifiedStops);
  }, [
    selection.kmRange,
    selection.selectedZoneId,
    presentedZones,
    verifiedStops,
    result.route,
    result.resupply_zones,
  ]);

  const effectiveLayers = useMemo(() => {
    const base = layersForOverlay(overlay);
    return timelineLayers.rejectedClimbs ? { ...base, rejectedClimbs: true } : base;
  }, [overlay, timelineLayers.rejectedClimbs]);

  const insights = useMemo(
    () => computeRouteInsights(presentedZones, result.route, result.summary.distance_km),
    [presentedZones, result.route, result.summary.distance_km],
  );

  const briefingHighlights = useMemo(
    () => buildRouteHighlights(result.climbs, presentedZones, result.route, result.summary.distance_km),
    [result.climbs, presentedZones, result.route, result.summary.distance_km],
  );

  const resupplyGaps = useMemo(
    () =>
      buildResupplyGapInsights(
        presentedZones,
        result.route.track_points,
        result.summary.distance_km,
      ),
    [presentedZones, result.route.track_points, result.summary.distance_km],
  );

  const poorPct = percentOfRoute(insights.resupplyMix.poor ?? 0, result.summary.distance_km);
  const inspectorPoint = activePoint(result.route.track_points, selection.activeIndex);

  const applyHighlight = useCallback(
    (highlight: RouteHighlight) => {
      applyBriefingHighlight(highlight, result, presentedZones, result.summary.distance_km, {
        onSelectClimb: selection.handleSelectClimb,
        onSelectKmRange: selection.handleSelectKmRange,
        onSelectSurface: setSelectedSurfaceType,
        onClearEntitySelection: selection.handleClearEntitySelection,
        setActiveIndex: selection.setActiveIndex,
      });
    },
    [presentedZones, result, selection, setSelectedSurfaceType],
  );

  function handleSelectHighlight(highlight: RouteHighlight) {
    applyHighlight(highlight);
  }

  useEffect(() => {
    if (!planningIntent) {
      return;
    }

    if (planningIntent.type === "briefing-highlight") {
      const highlight = briefingHighlights.find((item) => item.id === planningIntent.highlightId);
      if (highlight) {
        applyHighlight(highlight);
      }
      consumePlanningIntent();
      return;
    }

    if (planningIntent.type === "select-climb") {
      selection.handleSelectClimb(planningIntent.climbId);
      consumePlanningIntent();
      return;
    }

    if (planningIntent.type === "select-km-range") {
      selection.handleSelectKmRange({
        startKm: planningIntent.startKm,
        endKm: planningIntent.endKm,
        label: planningIntent.label,
      });
      if (planningIntent.surfaceCategory) {
        setSelectedSurfaceType(planningIntent.surfaceCategory);
      }
      consumePlanningIntent();
      return;
    }

    if (planningIntent.type === "surface-explore") {
      setOverlay("surface");
      if (planningIntent.surfaceCategory) {
        setSelectedSurfaceType(planningIntent.surfaceCategory);
      } else {
        setSelectedSurfaceType(null);
      }
      if (planningIntent.startKm !== undefined && planningIntent.endKm !== undefined) {
        selection.handleSelectKmRange({
          startKm: planningIntent.startKm,
          endKm: planningIntent.endKm,
          label: planningIntent.label ?? "Surface section",
        });
      } else {
        selection.handleClearEntitySelection();
      }
      consumePlanningIntent();
      return;
    }

    if (planningIntent.type === "jump-km") {
      selection.handleClearEntitySelection();
      selection.setActiveIndex(findNearestTrackIndex(result.route.track_points, planningIntent.km));
      consumePlanningIntent();
    }
  }, [
    planningIntent,
    briefingHighlights,
    applyHighlight,
    consumePlanningIntent,
    selection,
    setSelectedSurfaceType,
    setOverlay,
    result.route.track_points,
  ]);

  const selectedClimb =
    selection.selectedClimbId !== null
      ? sortedClimbs.find((climb) => climb.id === selection.selectedClimbId) ?? null
      : null;

  const selectedCandidate =
    selection.selectedCandidateId !== null
      ? (result.climb_candidates ?? []).find(
          (candidate) => candidate.candidate_id === selection.selectedCandidateId,
        ) ?? null
      : null;

  const hubSheetTitle =
    selection.detailSelection?.kind === "zone"
      ? selection.detailSelection.zone.name
      : selection.detailSelection?.kind === "poi"
        ? selection.detailSelection.poi.name ??
          selection.detailSelection.poi.brand ??
          "Stop detail"
        : "Resupply hub";

  function handleSelectPoiFromSheet(poi: import("../../api").ZonePoiOption) {
    const zone =
      selection.detailSelection?.kind === "zone"
        ? selection.detailSelection.zone
        : selection.detailSelection?.zone ?? null;
    selection.handleSelectPoi({ kind: "poi", poi, zone });
  }

  function handleBackToZoneFromSheet() {
    if (selection.detailSelection?.kind === "poi" && selection.detailSelection.zone) {
      selection.handleSelectZone(selection.detailSelection.zone.zone_id);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 pb-10 lg:px-6">
      <header className="relative space-y-2 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Route</h2>
          <p className="text-sm text-muted">{result.summary.route_name}</p>
        </div>

        <p className="text-sm text-muted">
          <span className="tabular-nums text-ink">{formatKm(result.summary.distance_km, 0)}</span>
          <span className="mx-2 text-line">·</span>
          <span className="tabular-nums text-ink">+{Math.round(result.summary.elevation_gain_m)} m</span>
          <span className="mx-2 text-line">·</span>
          <span className="tabular-nums text-ink">{result.summary.climb_count} climbs</span>
          <span className="mx-2 text-line">·</span>
          <span className="tabular-nums text-ink">{presentedZones.length} stops</span>
          {(overlay === "surface" || overlay === "normal") && (
            <>
              <span className="mx-2 text-line">·</span>
              <span className="tabular-nums text-ink">{result.summary.asphalt_pct}% road</span>
            </>
          )}
          {overlay === "resupply" && poorPct > 0 && (
            <>
              <span className="mx-2 text-line">·</span>
              <span className="text-red-700">{poorPct}% poor resupply</span>
            </>
          )}
        </p>

        {resupplyGaps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resupplyGaps.map((gap) => (
              <RoutePlanningInsight
                key={gap.id}
                icon={gap.icon}
                title={gap.label}
                distance={formatKm(gap.gapKm, 0)}
                elevationGain={`+${gap.elevationGainM.toLocaleString()} m`}
                detail={`km ${Math.round(gap.startKm)} → ${Math.round(gap.endKm)}`}
                active={
                  selection.kmRange?.startKm === gap.startKm &&
                  selection.kmRange?.endKm === gap.endKm
                }
                onClick={() =>
                  selection.handleSelectKmRange({
                    startKm: gap.startKm,
                    endKm: gap.endKm,
                    label: gap.label,
                  })
                }
              />
            ))}
          </div>
        )}

        <RouteExplorationBar />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStopsBrowseOpen(true)}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
          >
            Planning stops ({presentedZones.length})
          </button>

          {selection.kmRange && (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm">
              <span className="font-medium text-ink">{selection.kmRange.label}</span>
              <span className="text-muted">
                {formatKm(selection.kmRange.endKm - selection.kmRange.startKm, 0)}
              </span>
              <button
                type="button"
                onClick={selection.handleFocusKmRangeOnMap}
                className="text-xs font-semibold text-accent hover:text-accent/80"
              >
                Focus on map
              </button>
              <button
                type="button"
                onClick={selection.handleClearEntitySelection}
                className="text-xs font-semibold text-muted hover:text-ink"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <details className="rounded-xl border border-line bg-card px-4 py-2">
          <summary className="cursor-pointer text-sm font-medium text-ink">Map layers</summary>
          <div className="pt-3">
            <TimelineLayerControls />
          </div>
        </details>

        <button
          type="button"
          onClick={() => {
            setPoiDebugMode((current) => !current);
            setClimbDebugMode(false);
            setPoiDebugClick(null);
            setPoiDebugSelection(null);
            setClimbDebugClick(null);
          }}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
            poiDebugMode
              ? "border-accent bg-accent/10 text-accent"
              : "border-line bg-card text-muted hover:text-ink"
          }`}
        >
          {poiDebugMode ? "POI debug on" : "POI debug"}
        </button>
        <button
          type="button"
          onClick={() => {
            setClimbDebugMode((current) => !current);
            setPoiDebugMode(false);
            setPoiDebugClick(null);
            setPoiDebugSelection(null);
            setClimbDebugClick(null);
          }}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
            climbDebugMode
              ? "border-accent bg-accent/10 text-accent"
              : "border-line bg-card text-muted hover:text-ink"
          }`}
        >
          {climbDebugMode ? "Climb debug on" : "Climb debug"}
        </button>
      </header>

      {selectedClimb ? (
        <ClimbDetailView
          climb={selectedClimb}
          route={result.route}
          pois={result.pois}
          zones={presentedZones}
          totalKm={result.summary.distance_km}
          onClose={selection.handleClearEntitySelection}
        />
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="relative h-[min(58vh,680px)] min-h-[320px]">
              <RouteMap
                route={result.route}
                zones={presentedZones}
                climbs={sortedClimbs}
                rejectedClimbs={result.climb_candidates ?? []}
                showRejectedClimbs={timelineLayers.rejectedClimbs}
                zoneDensity={zoneDensity}
                overlay={overlay}
                timeMode={timeMode}
                arrivalTimeWindow={arrivalTimeWindow}
                selectedSurfaceType={selectedSurfaceType}
                activeIndex={selection.activeIndex}
                selectedZoneId={selection.selectedZoneId}
                selectedClimbId={selection.selectedClimbId}
                selectedCandidateId={selection.selectedCandidateId}
                highlightKmRange={highlightKmRange}
                focusKmRange={selection.mapFocusKmRange}
                fillHeight
                onActiveIndexChange={selection.setActiveIndex}
                onSelectZone={selection.handleSelectZone}
                onHoverZone={selection.handleHoverZone}
                onSelectClimb={selection.handleSelectClimb}
                onSelectCandidate={selection.handleSelectCandidate}
                onSelectPoi={selection.handleSelectPoi}
                poiDebugMode={poiDebugMode}
                climbDebugMode={climbDebugMode}
                onPoiDebugClick={(lat, lon) => {
                  setPoiDebugClick({ lat, lon });
                  const nearby = nearbyPoiDebugEntries(result.poi_debug ?? [], lat, lon);
                  setPoiDebugSelection(nearby[0]?.entry ?? null);
                }}
                onClimbDebugClick={(lat, lon) => {
                  setClimbDebugClick({ lat, lon });
                }}
              />
              {poiDebugMode && (
                <PoiDebugPanel
                  entries={poiDebugNearby}
                  selectedEntry={poiDebugSelection}
                  clickLatLng={poiDebugClick}
                  onSelectEntry={setPoiDebugSelection}
                  onClose={() => {
                    setPoiDebugClick(null);
                    setPoiDebugSelection(null);
                  }}
                />
              )}
              {climbDebugMode && (
                <ClimbDebugPanel
                  context={climbDebugContext}
                  onClose={() => {
                    setClimbDebugClick(null);
                  }}
                />
              )}
            </div>

            <ElevationProfile
              route={result.route}
              points={result.route.track_points}
              zones={presentedZones}
              climbs={sortedClimbs}
              rejectedClimbs={result.climb_candidates ?? []}
              layers={effectiveLayers}
              totalKm={result.summary.distance_km}
              overlay={overlay}
              timeMode={timeMode}
              selectedSurfaceType={selectedSurfaceType}
              maxGapThresholdKm={stageSettings.maxGapWithoutResupplyKm}
              activeIndex={selection.activeIndex}
              selectedZoneId={selection.selectedZoneId}
              selectedClimbId={selection.selectedClimbId}
              selectedCandidateId={selection.selectedCandidateId}
              highlightKmRange={highlightKmRange}
              hero
              onHoverIndex={selection.setActiveIndex}
              onSelectZone={selection.handleSelectZone}
              onHoverZone={selection.handleHoverZone}
              onSelectClimb={selection.handleSelectClimb}
              onSelectCandidate={selection.handleSelectCandidate}
              onSelectSurfaceType={setSelectedSurfaceType}
            />

            {activeSegmentSummary && (
              <ResupplySegmentSummary
                summary={activeSegmentSummary}
                compact
                onFocusOnMap={selection.handleFocusKmRangeOnMap}
                onClear={
                  selection.kmRange ? selection.handleClearEntitySelection : undefined
                }
              />
            )}

            <RouteInspector
              point={inspectorPoint}
              zones={presentedZones}
              overlay={overlay}
              timeMode={timeMode}
              route={result.route}
            />

            <MultiLayerTimeline
              totalKm={result.summary.distance_km}
              route={result.route}
              trackPoints={result.route.track_points}
              zones={presentedZones}
              climbs={sortedClimbs}
              rejectedClimbs={result.climb_candidates ?? []}
              layers={effectiveLayers}
              selectedZoneId={selection.selectedZoneId}
              selectedClimbId={selection.selectedClimbId}
              selectedSurfaceType={selectedSurfaceType}
              activeIndex={selection.activeIndex}
              highlightKmRange={highlightKmRange}
              maxGapThresholdKm={stageSettings.maxGapWithoutResupplyKm}
              onHoverIndex={selection.setActiveIndex}
              onSelectZone={selection.handleSelectZone}
              onHoverZone={selection.handleHoverZone}
              onSelectClimb={selection.handleSelectClimb}
              onSelectSurfaceType={setSelectedSurfaceType}
              onSelectKmRange={selection.handleSelectKmRange}
              onSelectCandidate={selection.handleSelectCandidate}
            />
          </div>

          <PlanningDetailSheet
            open={selection.detailSelection !== null}
            title={hubSheetTitle}
            subtitle="Resupply hub"
            onClose={selection.handleCloseDetail}
          >
            {selection.detailSelection && activeSegmentSummary && (
              <div className="mb-5">
                <ResupplySegmentSummary summary={activeSegmentSummary} compact />
              </div>
            )}
            {selection.detailSelection && (
              <ResupplyHubDetailContent
                selection={selection.detailSelection}
                route={result.route}
                timeWindowId={arrivalTimeWindow}
                timeMode={timeMode}
                onSelectPoi={handleSelectPoiFromSheet}
                onBackToZone={
                  selection.detailSelection.kind === "poi" && selection.detailSelection.zone
                    ? handleBackToZoneFromSheet
                    : undefined
                }
              />
            )}
          </PlanningDetailSheet>

          <PlanningDetailSheet
            open={selectedCandidate !== null}
            title={selectedCandidate?.rejection_label ?? "Rejected climb"}
            subtitle="Climb candidate"
            onClose={selection.handleClearEntitySelection}
          >
            {selectedCandidate && (
              <CandidateContextSummary
                candidate={selectedCandidate}
                onClose={selection.handleClearEntitySelection}
              />
            )}
          </PlanningDetailSheet>

          <RouteStopsBrowseSheet
            open={stopsBrowseOpen}
            onClose={() => setStopsBrowseOpen(false)}
            zones={presentedZones}
            totalZones={result.resupply_zones.length}
            zoneDensity={zoneDensity}
            timeMode={timeMode}
            selectedZoneId={selection.selectedZoneId}
            briefingHighlights={briefingHighlights}
            onSelectZone={selection.handleSelectZone}
            onHoverZone={selection.handleHoverZone}
            onSelectHighlight={handleSelectHighlight}
            onViewFullBriefing={onViewFullBriefing}
          />
        </>
      )}
    </div>
  );
}
