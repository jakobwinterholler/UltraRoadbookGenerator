import { Fragment, useEffect, useMemo, useRef } from "react";
import type { ClimbCandidateRow, ClimbRow, ResupplyZone } from "../../api";
import type { DecisionPanelView } from "../../planning/decisionPanel";
import type { RouteHighlight } from "../../planning/routeHighlights";
import type { OverlayMode, TimeMode, ZoneDensityMode } from "../../planning/types";
import { zoneAvailability } from "../../planning/stopAvailability";
import type { StopSelection } from "../../planning/stopSelection";
import { usePlanningAssumptions } from "../../planning/usePlanningAssumptions";
import StopDetailPanel from "../StopDetailPanel";
import { formatKm } from "../routeInsights";
import { elevationGainInKmRange } from "../../planning/resupplyGaps";
import RouteBriefing from "./RouteBriefing";
import CandidateContextSummary from "./CandidateContextSummary";
import ZoneListRow from "./ZoneListRow";
import RouteSegmentGapRow, { buildRouteSegmentGapMetrics } from "./RouteSegmentGapRow";
import { analyzeClimbs } from "../../planning/climbAnalysis";
import { climbDisplayName } from "../../planning/climbLabels";

interface RouteDecisionPanelProps {
  view: DecisionPanelView;
  zones: ResupplyZone[];
  totalZones: number;
  climbs: ClimbRow[];
  candidates: ClimbCandidateRow[];
  briefingHighlights: RouteHighlight[];
  trackPoints: import("../../api").TrackPoint[];
  overlay: OverlayMode;
  timeMode: TimeMode;
  zoneDensity: ZoneDensityMode;
  selectedZoneId: number | null;
  showOsmTags: boolean;
  onSelectHighlight: (highlight: RouteHighlight) => void;
  onViewFullBriefing: () => void;
  onSelectZone: (zoneId: number) => void;
  onDetailSelectionChange: (selection: StopSelection) => void;
  onCloseDetail: () => void;
  onClearEntity: () => void;
}

function SectionContextSummary({
  label,
  startKm,
  endKm,
  trackPoints,
  onClose,
}: {
  label: string;
  startKm: number;
  endKm: number;
  trackPoints: import("../../api").TrackPoint[];
  onClose: () => void;
}) {
  const gainM = elevationGainInKmRange(trackPoints, startKm, endKm);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Selected section</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent/80"
        >
          Clear
        </button>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {formatKm(endKm - startKm, 0)}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">+{gainM.toLocaleString()} m</p>
      <p className="mt-2 text-sm text-muted">
        km {Math.round(startKm)} → {Math.round(endKm)}
      </p>
    </div>
  );
}

export default function RouteDecisionPanel({
  view,
  zones,
  totalZones,
  climbs,
  candidates,
  briefingHighlights,
  trackPoints,
  overlay,
  timeMode,
  zoneDensity,
  selectedZoneId,
  showOsmTags,
  onSelectHighlight,
  onViewFullBriefing,
  onSelectZone,
  onDetailSelectionChange,
  onCloseDetail,
  onClearEntity,
}: RouteDecisionPanelProps) {
  const { arrivalTimeWindow } = usePlanningAssumptions();
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const selectedZone = zones.find((zone) => zone.zone_id === selectedZoneId) ?? null;

  const gapsByZone = useMemo(() => {
    const sorted = [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
    const map = new Map<number, ReturnType<typeof buildRouteSegmentGapMetrics> | null>();
    for (let index = 0; index < sorted.length; index += 1) {
      const zone = sorted[index];
      const previous = sorted[index - 1];
      if (!previous) {
        map.set(zone.zone_id, null);
        continue;
      }
      map.set(
        zone.zone_id,
        buildRouteSegmentGapMetrics(
          trackPoints,
          previous.distance_along_km,
          zone.distance_along_km,
        ),
      );
    }
    return map;
  }, [trackPoints, zones]);

  useEffect(() => {
    if (selectedZoneId === null) {
      return;
    }
    selectedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedZoneId]);

  function zoneDimmed(zone: ResupplyZone): boolean {
    if (!arrivalTimeWindow) {
      return false;
    }
    const availability = zoneAvailability(zone, arrivalTimeWindow, timeMode);
    return availability?.status === "closed";
  }

  function handleSelectPoi(poi: import("../../api").ZonePoiOption) {
    onDetailSelectionChange({
      kind: "poi",
      poi,
      zone: selectedZone,
    });
  }

  function handleBackToZone() {
    if (selectedZone) {
      onDetailSelectionChange({ kind: "zone", zone: selectedZone });
    }
  }

  if (view.type === "stop" && view.selection) {
    const selection = view.selection;
    return (
      <aside>
        <StopDetailPanel
          selection={selection}
          timeWindowId={arrivalTimeWindow}
          timeMode={timeMode}
          showOsmTags={showOsmTags}
          onClose={onCloseDetail}
          onSelectPoi={handleSelectPoi}
          onBackToZone={selection.kind === "poi" ? handleBackToZone : undefined}
        />
      </aside>
    );
  }

  if (view.type === "climb") {
    const climb = climbs.find((item) => item.id === view.climbId);
    if (!climb) {
      return null;
    }
    const analyzed = analyzeClimbs([climb])[0];
    return (
      <aside className="space-y-4">
        <div className="border-b border-line/60 pb-4">
          <p className="text-xs text-muted">Viewing climb</p>
          <p className="mt-1 font-semibold text-ink">{climbDisplayName(climb, analyzed.routeIndex)}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {climb.length_km.toFixed(1)} km · +{climb.elevation_gain_m} m · {analyzed.tier.label}
          </p>
          <button
            type="button"
            onClick={onClearEntity}
            className="mt-3 text-xs font-medium text-accent hover:text-accent/80"
          >
            Back to route map →
          </button>
        </div>

        <RouteBriefing
          highlights={briefingHighlights}
          onSelectHighlight={onSelectHighlight}
          onViewFullBriefing={onViewFullBriefing}
        />

        <div>
          <h3 className="text-sm font-semibold text-ink">Stops along route</h3>
          <p className="mt-0.5 text-xs text-muted">
            {zones.length} shown · {totalZones} total
          </p>
          <div className="mt-2">
            {zones.map((zone) => {
              const gap = gapsByZone.get(zone.zone_id);
              return (
                <Fragment key={zone.zone_id}>
                  {gap ? <RouteSegmentGapRow metrics={gap} compact /> : null}
                  <ZoneListRow
                    ref={selectedZoneId === zone.zone_id ? selectedRowRef : undefined}
                    zone={zone}
                    selected={selectedZoneId === zone.zone_id}
                    dimmed={zoneDimmed(zone)}
                    timeMode={timeMode}
                    onSelect={() => onSelectZone(zone.zone_id)}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  if (view.type === "candidate") {
    const candidate = candidates.find((item) => item.candidate_id === view.candidateId);
    if (!candidate) {
      return null;
    }
    return (
      <aside className="px-1">
        <CandidateContextSummary candidate={candidate} onClose={onClearEntity} />
      </aside>
    );
  }

  if (view.type === "section") {
    return (
      <aside className="px-1">
        <SectionContextSummary
          label={view.label}
          startKm={view.startKm}
          endKm={view.endKm}
          trackPoints={trackPoints}
          onClose={onClearEntity}
        />
      </aside>
    );
  }

  const modeSummary =
    timeMode === "night"
      ? "Stops · night planning"
      : overlay === "surface"
        ? "Stops on surface view"
        : overlay === "resupply"
          ? "Stops on resupply view"
          : "Stops along route";

  return (
    <aside className="space-y-4">
      <RouteBriefing
        highlights={briefingHighlights}
        onSelectHighlight={onSelectHighlight}
        onViewFullBriefing={onViewFullBriefing}
      />

      <div>
        <h3 className="text-sm font-semibold text-ink">{modeSummary}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {zones.length} shown · {totalZones} total · {zoneDensity}
        </p>

        <div className="mt-2">
          {zones.map((zone) => {
            const gap = gapsByZone.get(zone.zone_id);
            return (
              <Fragment key={zone.zone_id}>
                {gap ? <RouteSegmentGapRow metrics={gap} compact /> : null}
                <ZoneListRow
                  ref={selectedZoneId === zone.zone_id ? selectedRowRef : undefined}
                  zone={zone}
                  selected={selectedZoneId === zone.zone_id}
                  dimmed={zoneDimmed(zone)}
                  timeMode={timeMode}
                  onSelect={() => onSelectZone(zone.zone_id)}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
