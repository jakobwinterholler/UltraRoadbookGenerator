import { useMemo, useRef, useState } from "react";
import type { ClimbCandidateRow, ClimbRow, ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { surfaceSegmentMatchesSelection } from "../planning/surfaceBreakdown";
import type { TimelineLayers } from "../planning/timelineLayers";
import { colorAtKm, legendForView, routeSegmentsForOverlay, zoneMarkerColor } from "../planning/viewModel";
import type { OverlayMode, TimeMode } from "../planning/types";
import type { KmRangeSelection } from "../planning/useRouteWorkspaceSelection";
import { climbAtKm, layoutClimbLabels } from "./elevationProfileLabels";
import OverlayLegend from "./OverlayLegend";
import { findNearestTrackIndex } from "./routeUtils";
import { formatKm, nearestZoneAtKm, zoneHasCategory } from "./routeInsights";

interface ElevationProfileProps {
  route: RouteVisualization;
  points: TrackPoint[];
  zones: ResupplyZone[];
  climbs: ClimbRow[];
  rejectedClimbs: ClimbCandidateRow[];
  layers: TimelineLayers;
  totalKm: number;
  overlay: OverlayMode;
  timeMode: TimeMode;
  selectedSurfaceType: string | null;
  maxGapThresholdKm: number;
  activeIndex: number | null;
  selectedZoneId: number | null;
  selectedClimbId: string | null;
  selectedCandidateId: string | null;
  highlightKmRange?: KmRangeSelection | null;
  compact?: boolean;
  hero?: boolean;
  onHoverIndex: (index: number | null) => void;
  onSelectZone: (zoneId: number) => void;
  onHoverZone?: (zoneId: number | null) => void;
  onSelectClimb: (climbId: string) => void;
  onSelectCandidate: (candidateId: string) => void;
  onSelectSurfaceType: (surface: string | null) => void;
}

function pct(km: number, totalKm: number): number {
  return Math.min(Math.max((km / totalKm) * 100, 0), 100);
}

function gapSegments(
  zones: ResupplyZone[],
  totalKm: number,
  thresholdKm: number,
): { startPct: number; widthPct: number; danger: boolean }[] {
  const sorted = [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
  const segments: { startPct: number; widthPct: number; danger: boolean }[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gapKm = sorted[index + 1].distance_along_km - sorted[index].distance_along_km;
    if (gapKm < 10) {
      continue;
    }
    segments.push({
      startPct: pct(sorted[index].distance_along_km, totalKm),
      widthPct: pct(gapKm, totalKm),
      danger: gapKm >= thresholdKm,
    });
  }

  return segments;
}

export default function ElevationProfile({
  route,
  points,
  zones,
  climbs,
  rejectedClimbs,
  layers,
  totalKm,
  overlay,
  timeMode,
  selectedSurfaceType,
  maxGapThresholdKm,
  activeIndex,
  selectedZoneId,
  selectedClimbId,
  selectedCandidateId,
  highlightKmRange = null,
  compact = false,
  hero = false,
  onHoverIndex,
  onSelectZone,
  onHoverZone,
  onSelectClimb,
  onSelectCandidate,
  onSelectSurfaceType,
}: ElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverAnchor, setHoverAnchor] = useState<{ xPct: number; yPct: number } | null>(null);
  const routeSegments = useMemo(
    () => routeSegmentsForOverlay({ route, overlay }),
    [route, overlay],
  );
  const legend = legendForView(overlay, timeMode);
  const lineColor = overlay === "normal" ? "#E85D04" : colorAtKm(points[0]?.km ?? 0, routeSegments);

  const chart = useMemo(() => {
    const withElevation = points.filter((point) => point.ele_m !== null);
    if (withElevation.length < 2) {
      return null;
    }

    const width = 1000;
    const height = 240;
    const padding = { top: 24, right: 16, bottom: 36, left: 44 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minKm = withElevation[0].km;
    const maxKm = withElevation[withElevation.length - 1].km;
    const elevations = withElevation.map((point) => point.ele_m as number);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = Math.max(maxEle - minEle, 1);

    const xForKm = (km: number) =>
      padding.left + ((km - minKm) / Math.max(maxKm - minKm, 0.001)) * plotWidth;

    const coords = withElevation.map((point) => {
      const x = xForKm(point.km);
      const y =
        padding.top + (1 - ((point.ele_m as number) - minEle) / eleRange) * plotHeight;
      return { x, y, point };
    });

    const coloredSegments = route.surface_segments.map((segment) => ({
      x: xForKm(segment.start_km),
      width: Math.max(xForKm(segment.end_km) - xForKm(segment.start_km), 1),
      color: segment.color,
      osmSurface: segment.osm_surface ?? "unknown",
      selectionKey: segment.rider_category ?? segment.surface,
    }));

    const zoneMarkers = zones.map((zone) => ({
      zone,
      x: xForKm(zone.distance_along_km),
      color: zoneMarkerColor(zone, overlay, timeMode, routeSegments),
    }));

    const linePath = coords
      .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`)
      .join(" ");

    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`;

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      minKm,
      maxKm,
      minEle,
      maxEle,
      coords,
      linePath,
      areaPath,
      zoneMarkers,
      coloredSegments,
    };
  }, [points, route.surface_segments, overlay, timeMode, zones, routeSegments]);

  const hoveredClimbId = useMemo(() => {
    if (activeIndex === null) {
      return null;
    }
    const km = points[activeIndex]?.km;
    if (km === undefined) {
      return null;
    }
    return climbAtKm(climbs, km)?.id ?? null;
  }, [activeIndex, climbs, points]);

  const climbLayouts = useMemo(() => {
    if (!chart) {
      return [];
    }
    const xForKm = (km: number) =>
      chart.padding.left +
      ((km - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth;
    return layoutClimbLabels(climbs, xForKm, selectedClimbId, hoveredClimbId);
  }, [chart, climbs, hoveredClimbId, selectedClimbId]);

  function pickIndex(event: React.MouseEvent<SVGSVGElement>) {
    if (!chart || !svgRef.current) {
      return;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * chart.width;
    const relativeY = ((event.clientY - rect.top) / rect.height) * chart.height;

    if (
      relativeX < chart.padding.left ||
      relativeX > chart.width - chart.padding.right
    ) {
      onHoverIndex(null);
      setHoverAnchor(null);
      return;
    }

    const km =
      chart.minKm +
      ((relativeX - chart.padding.left) / chart.plotWidth) * (chart.maxKm - chart.minKm);
    onHoverIndex(findNearestTrackIndex(points, km));
    setHoverAnchor({
      xPct: (relativeX / chart.width) * 100,
      yPct: (relativeY / chart.height) * 100,
    });
  }

  function activePosition(): { x: number; y: number } | null {
    if (!chart || activeIndex === null) {
      return null;
    }
    const km = points[activeIndex]?.km;
    if (km === undefined) {
      return null;
    }

    const x =
      chart.padding.left +
      ((km - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth;

    for (let index = 0; index < chart.coords.length - 1; index += 1) {
      const start = chart.coords[index];
      const end = chart.coords[index + 1];
      if (km < start.point.km || km > end.point.km) {
        continue;
      }
      const span = Math.max(end.point.km - start.point.km, 0.001);
      const t = (km - start.point.km) / span;
      return { x, y: start.y + t * (end.y - start.y) };
    }

    const nearest = chart.coords.reduce((best, coord) => {
      const distance = Math.abs(coord.point.km - km);
      return distance < best.distance ? { coord, distance } : best;
    }, { coord: chart.coords[0], distance: Number.POSITIVE_INFINITY });

    return { x, y: nearest.coord.y };
  }

  if (!chart) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center shadow-card">
        <p className="text-muted">No elevation data available in this GPX file.</p>
      </div>
    );
  }

  const activeCoord = activePosition();
  const activePoint = activeIndex !== null ? points[activeIndex] ?? null : null;
  const nearestZone = activePoint ? nearestZoneAtKm(zones, activePoint.km) : null;
  const profileHeightClass = hero ? "h-64 md:h-80" : compact ? "h-28" : "h-56";
  const tooltipLeftPct = hoverAnchor
    ? Math.min(Math.max(hoverAnchor.xPct, 8), 92)
    : 50;
  const showTooltipBelowCursor = hoverAnchor ? hoverAnchor.yPct < 55 : true;

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    km: chart.minKm + (chart.maxKm - chart.minKm) * fraction,
    x: chart.padding.left + chart.plotWidth * fraction,
  }));

  const foodZones = zones.filter((zone) => zoneHasCategory(zone, "food"));
  const waterZones = zones.filter((zone) => zoneHasCategory(zone, "water"));
  const poorSegments = route.resupply_segments.filter((segment) => segment.quality === "poor");

  return (
    <div className={compact ? "shrink-0" : "rounded-2xl border border-line bg-card p-4 shadow-card"}>
      {(!compact || hero) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className={`font-semibold text-ink ${hero ? "text-base" : "text-sm"}`}>
            Elevation profile
          </h3>
          <div className="text-right text-xs text-muted">
            <p>
              Low {Math.round(chart.minEle)} m · High {Math.round(chart.maxEle)} m
            </p>
            <p>Range {Math.round(chart.maxEle - chart.minEle)} m</p>
          </div>
        </div>
      )}
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className={`w-full cursor-crosshair ${profileHeightClass}`}
        onMouseMove={pickIndex}
        onClick={pickIndex}
        onMouseLeave={() => {
          onHoverIndex(null);
          setHoverAnchor(null);
        }}
      >
        <defs>
          <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = chart.padding.top + chart.plotHeight * (1 - fraction);
          const elevation = Math.round(chart.minEle + (chart.maxEle - chart.minEle) * fraction);
          return (
            <g key={`grid-${fraction}`}>
              <line
                x1={chart.padding.left}
                y1={y}
                x2={chart.width - chart.padding.right}
                y2={y}
                stroke="#e7e5e4"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <text
                x={chart.padding.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-muted text-[10px]"
              >
                {elevation}
              </text>
            </g>
          );
        })}

        {layers.surface &&
          chart.coloredSegments.map((segment, index) => {
            const segmentRef = {
              rider_category: segment.selectionKey,
              surface: segment.selectionKey,
              osm_surface: segment.osmSurface,
            };
            const dimmed =
              selectedSurfaceType !== null && !surfaceSegmentMatchesSelection(segmentRef, selectedSurfaceType);
            const selected =
              selectedSurfaceType !== null && surfaceSegmentMatchesSelection(segmentRef, selectedSurfaceType);
            return (
              <rect
                key={`surface-${index}`}
                x={segment.x}
                y={chart.padding.top}
                width={segment.width}
                height={chart.plotHeight}
                fill={segment.color}
                opacity={dimmed ? 0.05 : selected ? 0.22 : 0.1}
                className="cursor-pointer"
                onClick={() => onSelectSurfaceType(selected ? null : segment.selectionKey)}
              />
            );
          })}

        {layers.dangerous &&
          poorSegments.map((segment, index) => {
            const x = chart.padding.left + ((segment.start_km - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth;
            const width = Math.max(
              ((segment.end_km - segment.start_km) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth,
              1,
            );
            return (
              <rect
                key={`danger-${index}`}
                x={x}
                y={chart.padding.top}
                width={width}
                height={chart.plotHeight}
                fill="#ef4444"
                opacity={0.08}
              />
            );
          })}

        {layers.food &&
          gapSegments(foodZones, totalKm, maxGapThresholdKm).map((segment, index) => (
            <rect
              key={`food-gap-${index}`}
              x={chart.padding.left + (segment.startPct / 100) * chart.plotWidth}
              y={chart.padding.top}
              width={(segment.widthPct / 100) * chart.plotWidth}
              height={chart.plotHeight}
              fill={segment.danger ? "#fbbf24" : "#fcd34d"}
              opacity={0.08}
            />
          ))}

        {layers.water &&
          gapSegments(waterZones, totalKm, maxGapThresholdKm * 0.7).map((segment, index) => (
            <rect
              key={`water-gap-${index}`}
              x={chart.padding.left + (segment.startPct / 100) * chart.plotWidth}
              y={chart.padding.top}
              width={(segment.widthPct / 100) * chart.plotWidth}
              height={chart.plotHeight}
              fill={segment.danger ? "#fb923c" : "#fdba74"}
              opacity={0.08}
            />
          ))}

        <path d={chart.areaPath} fill="url(#elevationFill)" />
        <path d={chart.linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" />

        {layers.rejectedClimbs &&
          rejectedClimbs
            .filter((candidate) => candidate.status === "rejected")
            .map((candidate) => {
              const x1 = chart.padding.left + ((candidate.start_km - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth;
              const x2 = chart.padding.left + ((candidate.end_km - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) * chart.plotWidth;
              return (
                <rect
                  key={candidate.candidate_id}
                  x={Math.min(x1, x2)}
                  y={chart.padding.top}
                  width={Math.max(Math.abs(x2 - x1), 2)}
                  height={chart.plotHeight}
                  fill={selectedCandidateId === candidate.candidate_id ? "#9ca3af" : "#d1d5db"}
                  opacity={0.35}
                  className="cursor-pointer"
                  onClick={() => onSelectCandidate(candidate.candidate_id)}
                />
              );
            })}

        {layers.climbs &&
          climbLayouts.map((layout) => {
            const { climb, x1, x2, showLabel, name } = layout;
            const selected = selectedClimbId === climb.id;
            const hovered = hoveredClimbId === climb.id;
            return (
              <g
                key={climb.id}
                className="cursor-pointer"
                onClick={() => onSelectClimb(climb.id)}
              >
                <rect
                  x={Math.min(x1, x2)}
                  y={chart.padding.top}
                  width={Math.max(Math.abs(x2 - x1), 2)}
                  height={chart.plotHeight}
                  fill={selected ? "#dc2626" : hovered ? "#ea580c" : "#f97316"}
                  opacity={selected ? 0.28 : hovered ? 0.22 : 0.14}
                />
                {showLabel && (
                  <text
                    x={(x1 + x2) / 2}
                    y={chart.padding.top + 12}
                    textAnchor="middle"
                    className={`text-[10px] font-semibold ${selected || hovered ? "fill-ink" : "fill-ink/80"}`}
                  >
                    ▲ {name}
                  </text>
                )}
              </g>
            );
          })}

        {layers.resupply &&
          chart.zoneMarkers.map(({ zone, x, color }) => (
            <g key={zone.zone_id}>
              <line
                x1={x}
                y1={chart.padding.top}
                x2={x}
                y2={chart.padding.top + chart.plotHeight}
                stroke={selectedZoneId === zone.zone_id ? color : "#d6d3d1"}
                strokeWidth={selectedZoneId === zone.zone_id ? 1.5 : 1}
                opacity={selectedZoneId === zone.zone_id ? 0.9 : 0.35}
              />
              <circle
                cx={x}
                cy={chart.padding.top + chart.plotHeight + 10}
                r="4"
                fill={color}
                className="cursor-pointer"
                onClick={() => onSelectZone(zone.zone_id)}
                onMouseEnter={() => onHoverZone?.(zone.zone_id)}
                onMouseLeave={() => onHoverZone?.(null)}
              />
            </g>
          ))}

        {axisTicks.map((tick) => (
          <text
            key={tick.km}
            x={tick.x}
            y={chart.height - 8}
            textAnchor="middle"
            className="fill-muted text-[11px]"
          >
            {Math.round(tick.km)}
          </text>
        ))}

        {highlightKmRange && (
          <rect
            x={
              chart.padding.left +
              ((highlightKmRange.startKm - chart.minKm) / Math.max(chart.maxKm - chart.minKm, 0.001)) *
                chart.plotWidth
            }
            y={chart.padding.top}
            width={Math.max(
              ((highlightKmRange.endKm - highlightKmRange.startKm) /
                Math.max(chart.maxKm - chart.minKm, 0.001)) *
                chart.plotWidth,
              2,
            )}
            height={chart.plotHeight}
            fill="#E85D04"
            opacity={0.12}
          />
        )}

        {activeCoord && (
          <>
            <line
              x1={activeCoord.x}
              y1={chart.padding.top}
              x2={activeCoord.x}
              y2={chart.padding.top + chart.plotHeight}
              stroke="#1c1917"
              strokeWidth="1.5"
              opacity={0.45}
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="5"
              fill={colorAtKm(points[activeIndex!]?.km ?? 0, routeSegments, lineColor)}
              stroke="white"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {activePoint && hoverAnchor && (
        <div
          className="pointer-events-none absolute z-20 max-w-[min(18rem,calc(100%-1rem))] rounded-lg border border-line/80 bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur"
          style={{
            left: `${tooltipLeftPct}%`,
            transform: "translateX(-50%)",
            ...(showTooltipBelowCursor
              ? { top: `clamp(0.5rem, calc(${hoverAnchor.yPct}% + 0.75rem), calc(100% - 4.5rem))` }
              : { bottom: `clamp(0.5rem, calc(${100 - hoverAnchor.yPct}% + 0.75rem), calc(100% - 4.5rem))` }),
          }}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-ink">
            <span>
              <span className="text-muted">Km </span>
              <span className="font-semibold">{formatKm(activePoint.km, 1)}</span>
            </span>
            <span>
              <span className="text-muted">Elev </span>
              <span className="font-semibold">
                {activePoint.ele_m !== null ? `${Math.round(activePoint.ele_m)} m` : "—"}
              </span>
            </span>
            <span>
              <span className="text-muted">Gain </span>
              <span className="font-semibold">+{Math.round(activePoint.cumulative_gain_m)} m</span>
            </span>
          </div>
          {nearestZone && (
            <p className="mt-1 truncate text-[11px] text-muted">
              Nearest stop: <span className="font-medium text-ink">{nearestZone.name}</span>
            </p>
          )}
        </div>
      )}
      </div>

      {legend.length > 0 && !compact && <OverlayLegend items={legend} className="mt-3" />}
    </div>
  );
}
