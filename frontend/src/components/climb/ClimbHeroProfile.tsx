import { useMemo } from "react";
import type { ClimbRow, PoiRow } from "../../api";
import type { SteepSection } from "../../planning/climbRoadbook";

export interface ProfileMarker {
  km: number;
  type: "start" | "summit" | "water" | "food" | "finish";
  label: string;
}

interface ClimbHeroProfileProps {
  climb: ClimbRow;
  climbId: string;
  points: Array<{ km: number; ele: number }>;
  steepSections?: SteepSection[];
  markers?: ProfileMarker[];
}

function buildDefaultMarkers(
  climb: ClimbRow,
  points: Array<{ km: number; ele: number }>,
  pois: PoiRow[],
): ProfileMarker[] {
  const markers: ProfileMarker[] = [
    { km: climb.start_km, type: "start", label: "Start" },
    { km: climb.end_km, type: "finish", label: "Finish" },
  ];

  if (points.length > 0) {
    const summit = points.reduce((best, point) => (point.ele > best.ele ? point : best), points[0]);
    markers.push({ km: summit.km, type: "summit", label: "Summit" });
  }

  for (const poi of pois) {
    if (poi.category === "Drinking water") {
      markers.push({ km: poi.distance_along_km, type: "water", label: poi.name ?? "Water" });
    } else if (
      poi.category.includes("supermarket") ||
      poi.category === "Bakery" ||
      poi.category === "Convenience store"
    ) {
      markers.push({ km: poi.distance_along_km, type: "food", label: poi.name ?? poi.category });
    }
  }

  return markers;
}

export function profileMarkersForClimb(
  climb: ClimbRow,
  points: Array<{ km: number; ele: number }>,
  onClimbWater: PoiRow[],
  onClimbFood: PoiRow[],
): ProfileMarker[] {
  return buildDefaultMarkers(climb, points, [...onClimbWater, ...onClimbFood]);
}

const MARKER_COLORS: Record<ProfileMarker["type"], string> = {
  start: "#78716c",
  summit: "#E85D04",
  water: "#0284c7",
  food: "#ca8a04",
  finish: "#E85D04",
};

const MARKER_LEGEND: Array<{ type: ProfileMarker["type"]; label: string }> = [
  { type: "start", label: "Start" },
  { type: "summit", label: "Summit" },
  { type: "water", label: "Water" },
  { type: "food", label: "Food" },
  { type: "finish", label: "Finish" },
];

export default function ClimbHeroProfile({
  climb,
  climbId,
  points,
  steepSections = [],
  markers = [],
}: ClimbHeroProfileProps) {
  const fillId = `climbProfileFill-${climbId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const chart = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const width = 960;
    const height = 300;
    const padding = { left: 8, right: 8, top: 20, bottom: 32 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minKm = points[0].km;
    const maxKm = points[points.length - 1].km;
    const kmSpan = Math.max(maxKm - minKm, 0.001);
    const elevations = points.map((point) => point.ele);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = Math.max(maxEle - minEle, 1);

    const toX = (km: number) => padding.left + ((km - minKm) / kmSpan) * plotWidth;
    const toY = (ele: number) => padding.top + (1 - (ele - minEle) / eleRange) * plotHeight;

    const coords = points.map((point) => ({
      x: toX(point.km),
      y: toY(point.ele),
      point,
    }));

    const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`;

    const steepRects = steepSections.map((section) => {
      const x1 = toX(section.startKm);
      const x2 = toX(section.endKm);
      return { x: Math.min(x1, x2), width: Math.max(Math.abs(x2 - x1), 3), section };
    });

    const markerPoints = markers.map((marker) => ({
      marker,
      x: toX(marker.km),
      y: toY(
        marker.type === "summit"
          ? maxEle
          : points.find((point) => Math.abs(point.km - marker.km) < 0.05)?.ele ?? minEle,
      ),
    }));

    const tickCount = Math.min(6, Math.max(3, Math.round(kmSpan / 4)));
    const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
      const km = minKm + (kmSpan * index) / tickCount;
      return { km, x: toX(km) };
    });

    return {
      width,
      height,
      padding,
      plotHeight,
      linePath,
      areaPath,
      steepRects,
      markerPoints,
      minEle,
      maxEle,
      ticks,
    };
  }, [markers, points, steepSections]);

  if (!chart) {
    return (
      <div className="rounded-xl bg-canvas/50 px-4 py-8 text-sm text-muted">
        Elevation profile unavailable for this climb.
      </div>
    );
  }

  const activeLegend = MARKER_LEGEND.filter(
    (entry) => entry.type === "summit" || markers.some((marker) => marker.type === entry.type),
  );

  return (
    <div className="-mx-1">
      <div className="mb-2 flex items-center justify-between text-xs tabular-nums text-muted">
        <span>{Math.round(chart.minEle)} m</span>
        <span className="font-medium text-ink">+{climb.elevation_gain_m} m</span>
        <span>{Math.round(chart.maxEle)} m</span>
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-52 w-full sm:h-60 md:h-72 lg:h-80"
        role="img"
        aria-label={`Elevation profile for ${climb.id}`}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E85D04" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#E85D04" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {chart.steepRects.map(({ x, width, section }) => (
          <rect
            key={`${section.startKm}-${section.endKm}`}
            x={x}
            y={chart.padding.top}
            width={width}
            height={chart.plotHeight}
            fill="#dc2626"
            opacity={0.16}
            rx={2}
          />
        ))}

        <path d={chart.areaPath} fill={`url(#${fillId})`} />
        <path
          d={chart.linePath}
          fill="none"
          stroke="#E85D04"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.markerPoints.map(({ marker, x, y }) => (
          <g key={`${marker.type}-${marker.km}-${marker.label}`}>
            <line
              x1={x}
              x2={x}
              y1={chart.padding.top}
              y2={chart.padding.top + chart.plotHeight}
              stroke={MARKER_COLORS[marker.type]}
              strokeWidth={1}
              strokeDasharray={marker.type === "start" || marker.type === "finish" ? "4 3" : "0"}
              opacity={0.35}
            />
            <circle cx={x} cy={y} r={marker.type === "summit" ? 5 : 4} fill={MARKER_COLORS[marker.type]} />
          </g>
        ))}

        {chart.ticks.map(({ km, x }) => (
          <g key={km}>
            <line
              x1={x}
              x2={x}
              y1={chart.padding.top + chart.plotHeight}
              y2={chart.padding.top + chart.plotHeight + 4}
              stroke="#d6d3d1"
            />
            <text x={x} y={chart.height - 8} textAnchor="middle" className="fill-stone-400 text-[11px]">
              {Math.round(km)}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {steepSections.length > 0 && <span>Steep ramps</span>}
        {activeLegend.map((entry) => (
          <span key={entry.type} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: MARKER_COLORS[entry.type] }}
            />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
