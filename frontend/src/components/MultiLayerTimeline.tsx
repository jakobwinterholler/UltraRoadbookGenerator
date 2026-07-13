import type { ClimbCandidateRow, ClimbRow, ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { surfaceSegmentMatchesSelection } from "../planning/surfaceBreakdown";
import type { TimelineLayers } from "../planning/timelineLayers";
import type { KmRangeSelection } from "../planning/useRouteWorkspaceSelection";
import { climbDisplayName } from "../planning/climbLabels";
import { climbTimelineKm, majorTimelineClimbs } from "../planning/majorTimelineClimbs";
import {
  timelineKmPercent,
  timelineLayout,
  timelinePointStyle,
  timelineRangeStyle,
} from "../planning/timelineLayout";
import { findNearestTrackIndex } from "./routeUtils";
import { zoneHasCategory } from "./routeInsights";
import { formatKm } from "./routeInsights";
import { resupplySegmentBands } from "../planning/resupplySegments";

interface MultiLayerTimelineProps {
  totalKm: number;
  route: RouteVisualization;
  trackPoints: TrackPoint[];
  zones: ResupplyZone[];
  climbs: ClimbRow[];
  rejectedClimbs: ClimbCandidateRow[];
  layers: TimelineLayers;
  selectedZoneId: number | null;
  selectedClimbId: string | null;
  selectedSurfaceType: string | null;
  activeIndex: number | null;
  highlightKmRange?: KmRangeSelection | null;
  maxGapThresholdKm: number;
  onHoverIndex: (index: number | null) => void;
  onSelectZone: (zoneId: number) => void;
  onHoverZone?: (zoneId: number | null) => void;
  onSelectClimb: (climbId: string) => void;
  onSelectSurfaceType: (surface: string | null) => void;
  onSelectKmRange?: (range: KmRangeSelection) => void;
  onSelectCandidate?: (candidateId: string) => void;
  compact?: boolean;
}

function TimelineRow({
  label,
  layout,
  compact = false,
  children,
}: {
  label: string;
  layout: ReturnType<typeof timelineLayout>;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: `${layout.labelWidth}px minmax(0, 1fr)`,
        columnGap: layout.gap,
      }}
    >
      <p
        className={`font-medium text-muted ${
          compact ? "text-[9px]" : "text-[10px] font-semibold uppercase tracking-[0.12em]"
        }`}
      >
        {label}
      </p>
      <div className={`relative ${compact ? "h-4" : "h-5"}`}>{children}</div>
    </div>
  );
}

function TimelinePoint({
  km,
  totalKm,
  title,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  km: number;
  totalKm: number;
  title?: string;
  className: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={timelinePointStyle(km, totalKm)}
    >
      {children}
    </button>
  );
}

function categoryZones(zones: ResupplyZone[], key: "food" | "water"): ResupplyZone[] {
  return zones.filter((zone) => zoneHasCategory(zone, key));
}

function gapSegments(
  zones: ResupplyZone[],
  thresholdKm: number,
): { startKm: number; endKm: number; danger: boolean }[] {
  const sorted = [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
  const segments: { startKm: number; endKm: number; danger: boolean }[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const startKm = sorted[index].distance_along_km;
    const endKm = sorted[index + 1].distance_along_km;
    const gapKm = endKm - startKm;
    if (gapKm < 10) {
      continue;
    }
    segments.push({
      startKm,
      endKm,
      danger: gapKm >= thresholdKm,
    });
  }

  return segments;
}

export default function MultiLayerTimeline({
  totalKm,
  route,
  trackPoints,
  zones,
  climbs,
  rejectedClimbs,
  layers,
  selectedZoneId,
  selectedClimbId,
  selectedSurfaceType,
  activeIndex,
  highlightKmRange = null,
  maxGapThresholdKm,
  onHoverIndex,
  onSelectZone,
  onHoverZone,
  onSelectClimb,
  onSelectSurfaceType,
  onSelectKmRange,
  onSelectCandidate,
  compact = false,
}: MultiLayerTimelineProps) {
  if (totalKm <= 0) {
    return null;
  }

  const layout = timelineLayout(compact);
  const trackStyle = {
    left: layout.trackInset,
    right: 0,
  } as const;

  const activeKm = activeIndex !== null ? trackPoints[activeIndex]?.km ?? null : null;
  const activeLeftPct = activeKm !== null ? timelineKmPercent(activeKm, totalKm) : null;

  const majorClimbs = useMemo(() => majorTimelineClimbs(climbs), [climbs]);
  const showMajorClimbs = (layers.climbs || layers.resupply) && majorClimbs.length > 0;

  function handleTrackHover(clientX: number, trackLeft: number, trackWidth: number) {
    if (trackWidth <= 0) {
      return;
    }
    const fraction = Math.min(Math.max((clientX - trackLeft) / trackWidth, 0), 1);
    const km = fraction * totalKm;
    onHoverIndex(findNearestTrackIndex(trackPoints, km));
  }

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    km: totalKm * fraction,
    leftPct: fraction * 100,
  }));

  const foodZones = categoryZones(zones, "food");
  const waterZones = categoryZones(zones, "water");
  const sortedZones = useMemo(
    () => [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km),
    [zones],
  );
  const resupplyBands = useMemo(() => resupplySegmentBands(sortedZones), [sortedZones]);
  const poorSegments = route.resupply_segments.filter((segment) => segment.quality === "poor");

  const containerStyle = {
    "--tl-track-inset": `${layout.trackInset}px`,
  } as CSSProperties;

  return (
    <div
      className={`relative shrink-0 space-y-1.5 ${compact ? "pt-1" : "space-y-2 rounded-2xl border border-line bg-card p-4 shadow-card"}`}
      style={containerStyle}
    >
      {!compact && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Route timeline</h3>
          <p className="text-xs text-muted">{formatKm(totalKm, 0)} total</p>
        </div>
      )}

      <div
        className="relative"
        onMouseMove={(event) => {
          const track = event.currentTarget.querySelector<HTMLElement>("[data-timeline-track]");
          if (!track) {
            return;
          }
          const rect = track.getBoundingClientRect();
          handleTrackHover(event.clientX, rect.left, rect.width);
        }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        <div
          data-timeline-track=""
          className="pointer-events-none absolute bottom-0 top-0 z-20"
          style={trackStyle}
        >
          {highlightKmRange && (
            <>
              <div
                className="absolute inset-y-0 rounded-sm bg-accent/10"
                style={timelineRangeStyle(highlightKmRange.startKm, highlightKmRange.endKm, totalKm)}
              />
              <div
                className="absolute inset-y-0 w-px -translate-x-1/2 bg-accent/70"
                style={timelinePointStyle(highlightKmRange.startKm, totalKm)}
              />
              <div
                className="absolute inset-y-0 w-px -translate-x-1/2 bg-accent/70"
                style={timelinePointStyle(highlightKmRange.endKm, totalKm)}
              />
            </>
          )}
          {activeLeftPct !== null && (
            <div
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink/50"
              style={{ left: `${activeLeftPct}%` }}
            />
          )}
        </div>

        {layers.surface && (
          <TimelineRow label="Surface" layout={layout} compact={compact}>
            <div className="absolute inset-y-1 inset-x-0 overflow-hidden rounded-full bg-line/70">
              {route.surface_segments.map((segment, index) => {
                const selectionKey = segment.rider_category ?? segment.surface;
                const dimmed =
                  selectedSurfaceType !== null &&
                  !surfaceSegmentMatchesSelection(segment, selectedSurfaceType);
                const selected =
                  selectedSurfaceType !== null &&
                  surfaceSegmentMatchesSelection(segment, selectedSurfaceType);
                return (
                  <button
                    key={`surface-${index}`}
                    type="button"
                    title={`${segment.rider_subcategory ?? segment.surface}`}
                    onClick={() => onSelectSurfaceType(selected ? null : selectionKey)}
                    className="absolute inset-y-0"
                    style={{
                      ...timelineRangeStyle(segment.start_km, segment.end_km, totalKm),
                      minWidth: "0.2%",
                      backgroundColor: segment.color,
                      opacity: dimmed ? 0.15 : selected ? 1 : 0.85,
                    }}
                  />
                );
              })}
            </div>
          </TimelineRow>
        )}

        {layers.food && (
          <TimelineRow label="Food" layout={layout} compact={compact}>
            <div className="absolute inset-y-1 inset-x-0 rounded-full bg-red-100/80">
              {gapSegments(foodZones, maxGapThresholdKm).map((segment, index) => (
                <button
                  key={`food-gap-${index}`}
                  type="button"
                  title={`${formatKm(segment.endKm - segment.startKm, 0)} food gap`}
                  onClick={() =>
                    onSelectKmRange?.({
                      startKm: segment.startKm,
                      endKm: segment.endKm,
                      label: "Longest food gap",
                    })
                  }
                  className={`absolute inset-y-0 ${segment.danger ? "bg-amber-400/45" : "bg-amber-300/40"} ${
                    onSelectKmRange ? "cursor-pointer hover:bg-amber-400/60" : ""
                  }`}
                  style={timelineRangeStyle(segment.startKm, segment.endKm, totalKm)}
                />
              ))}
              {foodZones.map((zone) => (
                <TimelinePoint
                  key={`food-${zone.zone_id}`}
                  km={zone.distance_along_km}
                  totalKm={totalKm}
                  title={zone.name}
                  onClick={() => onSelectZone(zone.zone_id)}
                  onMouseEnter={() => onHoverZone?.(zone.zone_id)}
                  onMouseLeave={() => onHoverZone?.(null)}
                  className={`h-3 w-3 rounded-full border-2 ${
                    selectedZoneId === zone.zone_id
                      ? "border-ink bg-emerald-500"
                      : "border-white bg-emerald-400"
                  }`}
                >
                  <span className="sr-only">{zone.name}</span>
                </TimelinePoint>
              ))}
            </div>
          </TimelineRow>
        )}

        {layers.water && (
          <TimelineRow label="Water" layout={layout} compact={compact}>
            <div className="absolute inset-y-1 inset-x-0 rounded-full bg-sky-100/70">
              {gapSegments(waterZones, maxGapThresholdKm * 0.7).map((segment, index) => (
                <button
                  key={`water-gap-${index}`}
                  type="button"
                  title={`${formatKm(segment.endKm - segment.startKm, 0)} water gap`}
                  onClick={() =>
                    onSelectKmRange?.({
                      startKm: segment.startKm,
                      endKm: segment.endKm,
                      label: "Longest water gap",
                    })
                  }
                  className={`absolute inset-y-0 ${segment.danger ? "bg-orange-300/40" : "bg-orange-300/35"} ${
                    onSelectKmRange ? "cursor-pointer hover:bg-orange-300/55" : ""
                  }`}
                  style={timelineRangeStyle(segment.startKm, segment.endKm, totalKm)}
                />
              ))}
              {waterZones.map((zone) => (
                <TimelinePoint
                  key={`water-${zone.zone_id}`}
                  km={zone.distance_along_km}
                  totalKm={totalKm}
                  title={zone.name}
                  onClick={() => onSelectZone(zone.zone_id)}
                  onMouseEnter={() => onHoverZone?.(zone.zone_id)}
                  onMouseLeave={() => onHoverZone?.(null)}
                  className={`h-3 w-3 rounded-full border-2 ${
                    selectedZoneId === zone.zone_id
                      ? "border-ink bg-sky-500"
                      : "border-white bg-sky-400"
                  }`}
                >
                  <span className="sr-only">{zone.name}</span>
                </TimelinePoint>
              ))}
            </div>
          </TimelineRow>
        )}

        {showMajorClimbs && (
          <TimelineRow label="Climbs" layout={layout} compact={compact}>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line/50" />
            {majorClimbs.map((climb, index) => {
              const km = climbTimelineKm(climb);
              const selected = selectedClimbId === climb.id;
              return (
                <TimelinePoint
                  key={climb.id}
                  km={km}
                  totalKm={totalKm}
                  title={`${climbDisplayName(climb, index)} · +${Math.round(climb.elevation_gain_m)} m`}
                  onClick={() => onSelectClimb(climb.id)}
                  className={selected ? "scale-110" : "opacity-85 hover:opacity-100"}
                >
                  <span
                    className={`block w-0.5 rounded-full ${
                      selected ? "h-3.5 bg-orange-600" : "h-2.5 bg-orange-500/70"
                    }`}
                    aria-hidden
                  />
                </TimelinePoint>
              );
            })}
            {layers.rejectedClimbs &&
              rejectedClimbs
                .filter((candidate) => candidate.status === "rejected")
                .map((candidate) => (
                  <TimelinePoint
                    key={candidate.candidate_id}
                    km={(candidate.start_km + candidate.end_km) / 2}
                    totalKm={totalKm}
                    title={candidate.rejection_label ?? "Rejected climb"}
                    onClick={() => onSelectCandidate?.(candidate.candidate_id)}
                    className="text-[10px] text-muted"
                  >
                    △
                  </TimelinePoint>
                ))}
          </TimelineRow>
        )}

        {layers.resupply && (
          <TimelineRow label="Stops" layout={layout} compact={compact}>
            <div className="absolute inset-y-1 inset-x-0 rounded-full bg-accent/5">
              {resupplyBands.map((band) => (
                <button
                  key={`resupply-band-${band.endZoneId}`}
                  type="button"
                  title="Resupply section"
                  onClick={() => onSelectZone(band.endZoneId)}
                  onMouseEnter={() => onHoverZone?.(band.endZoneId)}
                  onMouseLeave={() => onHoverZone?.(null)}
                  className="absolute inset-y-0 min-w-[0.4%] cursor-pointer hover:bg-accent/10"
                  style={timelineRangeStyle(band.startKm, band.endKm, totalKm)}
                />
              ))}
              {sortedZones.map((zone) => (
                <TimelinePoint
                  key={`resupply-${zone.zone_id}`}
                  km={zone.distance_along_km}
                  totalKm={totalKm}
                  title={zone.name}
                  onClick={() => onSelectZone(zone.zone_id)}
                  onMouseEnter={() => onHoverZone?.(zone.zone_id)}
                  onMouseLeave={() => onHoverZone?.(null)}
                  className={`h-3.5 w-3.5 rounded-full border-2 ${
                    selectedZoneId === zone.zone_id
                      ? "border-ink bg-accent"
                      : "border-white bg-accent/80"
                  }`}
                >
                  <span className="sr-only">{zone.name}</span>
                </TimelinePoint>
              ))}
            </div>
          </TimelineRow>
        )}

        {layers.dangerous && (
          <TimelineRow label="Risk" layout={layout} compact={compact}>
            <div className="absolute inset-y-1 inset-x-0 rounded-full bg-line/50">
              {poorSegments.map((segment, index) => (
                <div
                  key={`danger-${index}`}
                  className="absolute inset-y-0 min-w-[0.2%] bg-red-500/45"
                  style={timelineRangeStyle(segment.start_km, segment.end_km, totalKm)}
                  title={segment.label}
                />
              ))}
            </div>
          </TimelineRow>
        )}

        <div className="relative mt-1" style={{ marginLeft: layout.trackInset, height: compact ? 12 : 16 }}>
          {axisTicks.map((tick) => (
            <span
              key={tick.km}
              className={`absolute -translate-x-1/2 tabular-nums text-muted ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
              style={{ left: `${tick.leftPct}%` }}
            >
              {Math.round(tick.km)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
