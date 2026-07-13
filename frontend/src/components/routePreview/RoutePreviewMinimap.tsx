import { useMemo } from "react";
import type { TrackPoint } from "../../api";
import {
  buildMinimapProjection,
  projectKmOnMinimap,
  type RoutePreviewVerifiedStop,
} from "../../routePreview/routePreviewHud";

interface RoutePreviewMinimapProps {
  trackPoints: TrackPoint[];
  currentKm: number;
  totalKm: number;
  verifiedStops: RoutePreviewVerifiedStop[];
  playbackPosition?: { lat: number; lon: number } | null;
  playbackBearing?: number;
  playbackRoutePoints?: Array<{ lat: number; lon: number; km: number }>;
}

export default function RoutePreviewMinimap({
  trackPoints,
  currentKm,
  totalKm,
  verifiedStops,
  playbackPosition,
  playbackBearing,
  playbackRoutePoints,
}: RoutePreviewMinimapProps) {
  const minimap = useMemo(
    () =>
      buildMinimapProjection(
        trackPoints,
        currentKm,
        totalKm,
        10,
        112,
        112,
        8,
        playbackPosition ?? undefined,
        playbackBearing,
        playbackRoutePoints,
      ),
    [trackPoints, currentKm, totalKm, playbackPosition, playbackBearing, playbackRoutePoints],
  );

  const stopMarkers = useMemo(
    () =>
      verifiedStops.map((stop) => ({
        stop,
        point: projectKmOnMinimap(
          trackPoints,
          stop,
          minimap.width,
          minimap.height,
        ),
      })),
    [trackPoints, verifiedStops, minimap.height, minimap.width],
  );

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 overflow-hidden rounded-xl border border-white/15 bg-black/55 shadow-lg backdrop-blur-sm">
      <svg
        viewBox={`0 0 ${minimap.width} ${minimap.height}`}
        className="h-[5.5rem] w-[5.5rem] md:h-24 md:w-24"
        aria-label="Route minimap"
      >
        <rect width={minimap.width} height={minimap.height} fill="#111827" opacity="0.92" />
        <path
          d={minimap.pathD}
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {minimap.sectionPathD ? (
          <path
            d={minimap.sectionPathD}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {stopMarkers.map(({ stop, point }) => (
          <text
            key={stop.zoneId}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
          >
            {stop.icon}
          </text>
        ))}
        <circle cx={minimap.marker.x} cy={minimap.marker.y} r="4.5" fill="#6D28D9" />
        <circle cx={minimap.marker.x} cy={minimap.marker.y} r="1.8" fill="#ffffff" />
        <g
          transform={`translate(${minimap.marker.x}, ${minimap.marker.y}) rotate(${minimap.headingDeg})`}
        >
          <path d="M0,-8 L3.5,2.5 L0,0 L-3.5,2.5 Z" fill="#ffffff" opacity="0.95" />
        </g>
      </svg>
    </div>
  );
}
