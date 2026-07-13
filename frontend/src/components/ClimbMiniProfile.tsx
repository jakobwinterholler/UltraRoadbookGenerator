import { useMemo } from "react";
import type { ClimbRow } from "../api";
import { climbProfilePoints } from "../planning/climbRoadbook";
import type { SteepSection } from "../planning/climbRoadbook";

interface ClimbMiniProfileProps {
  climb: ClimbRow;
  points: Array<{ km: number; ele: number }>;
  steepSections?: SteepSection[];
}

export default function ClimbMiniProfile({ climb, points, steepSections = [] }: ClimbMiniProfileProps) {
  const chart = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const width = 320;
    const height = 96;
    const padding = { left: 4, right: 4, top: 8, bottom: 8 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minKm = points[0].km;
    const maxKm = points[points.length - 1].km;
    const elevations = points.map((point) => point.ele);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = Math.max(maxEle - minEle, 1);

    const coords = points.map((point) => ({
      x: padding.left + ((point.km - minKm) / Math.max(maxKm - minKm, 0.001)) * plotWidth,
      y: padding.top + (1 - (point.ele - minEle) / eleRange) * plotHeight,
      point,
    }));

    const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");
    const steepRects = steepSections.map((section) => {
      const x1 = padding.left + ((section.startKm - minKm) / Math.max(maxKm - minKm, 0.001)) * plotWidth;
      const x2 = padding.left + ((section.endKm - minKm) / Math.max(maxKm - minKm, 0.001)) * plotWidth;
      return { x: Math.min(x1, x2), width: Math.max(Math.abs(x2 - x1), 2), section };
    });

    return { width, height, linePath, steepRects, minEle, maxEle, coords };
  }, [points, steepSections]);

  if (!chart) {
    return (
      <div className="rounded-xl bg-canvas/80 px-3 py-4 text-xs text-muted">
        Elevation profile unavailable for this climb.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
        <span>{Math.round(chart.minEle)} m</span>
        <span className="font-medium text-ink">+{climb.elevation_gain_m} m</span>
        <span>{Math.round(chart.maxEle)} m</span>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-24 w-full">
        {chart.steepRects.map(({ x, width, section }) => (
          <rect
            key={`${section.startKm}-${section.endKm}`}
            x={x}
            y={8}
            width={width}
            height={80}
            fill="#dc2626"
            opacity={0.12}
          />
        ))}
        <path d={chart.linePath} fill="none" stroke="#E85D04" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {steepSections.length > 0 && (
        <p className="mt-1 text-[11px] text-muted">
          Steepest: {steepSections.map((section) => section.label).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function climbMiniProfileFromTrack(climb: ClimbRow, trackPoints: Parameters<typeof climbProfilePoints>[1]) {
  return climbProfilePoints(climb, trackPoints);
}
