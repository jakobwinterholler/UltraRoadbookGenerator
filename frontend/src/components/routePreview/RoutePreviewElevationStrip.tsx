import { useMemo } from "react";
import type { TrackPoint } from "../../api";
import { formatRouteKm } from "../../routePreview/formatRouteKm";
import {
  buildRouteProfileFromTrack,
  routeProfileMarkerAtKm,
  routeProfilePath,
  type RoutePreviewVerifiedStop,
} from "../../routePreview/routePreviewHud";

const PROFILE_WIDTH = 800;
const PROFILE_HEIGHT = 36;

interface RoutePreviewElevationStripProps {
  trackPoints: TrackPoint[];
  currentKm: number;
  totalKm: number;
  verifiedStops: RoutePreviewVerifiedStop[];
  activeClimb?: { startKm: number; endKm: number } | null;
  showKmReadout?: boolean;
}

export default function RoutePreviewElevationStrip({
  trackPoints,
  currentKm,
  totalKm,
  verifiedStops,
  activeClimb = null,
  showKmReadout = false,
}: RoutePreviewElevationStripProps) {
  const profile = useMemo(() => buildRouteProfileFromTrack(trackPoints), [trackPoints]);
  const profilePath = useMemo(
    () => routeProfilePath(profile, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile],
  );
  const marker = useMemo(
    () =>
      routeProfileMarkerAtKm(
        profile,
        trackPoints,
        currentKm,
        PROFILE_WIDTH,
        PROFILE_HEIGHT,
      ),
    [profile, trackPoints, currentKm],
  );

  const stopMarkers = useMemo(
    () =>
      verifiedStops.map((stop) => ({
        stop,
        x:
          4 +
          (stop.km / Math.max(0.001, profile.totalKm)) * (PROFILE_WIDTH - 8),
      })),
    [profile.totalKm, verifiedStops],
  );

  const climbHighlight = useMemo(() => {
    if (!activeClimb) {
      return null;
    }
    const x1 = 4 + (activeClimb.startKm / Math.max(0.001, profile.totalKm)) * (PROFILE_WIDTH - 8);
    const x2 = 4 + (activeClimb.endKm / Math.max(0.001, profile.totalKm)) * (PROFILE_WIDTH - 8);
    return {
      x: Math.min(x1, x2),
      width: Math.max(4, Math.abs(x2 - x1)),
    };
  }, [activeClimb, profile.totalKm]);

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#070707] px-2 py-1 md:px-3">
      {showKmReadout ? (
        <div className="mb-0.5 flex items-center justify-between text-[10px] tabular-nums text-white/45">
          <span>0 km</span>
          <span>
            {formatRouteKm(currentKm)} / {formatRouteKm(totalKm)}
          </span>
          <span>{formatRouteKm(totalKm)}</span>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-7 w-full rounded-md bg-[#0f1117] md:h-8"
        aria-label="Elevation profile"
      >
        <defs>
          <linearGradient id="routePreviewProfileFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6D28D9" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#6D28D9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {climbHighlight ? (
          <rect
            x={climbHighlight.x}
            y="1"
            width={climbHighlight.width}
            height={PROFILE_HEIGHT - 2}
            fill="#f59e0b"
            opacity="0.14"
            rx="2"
          />
        ) : null}
        <path
          d={`${profilePath} L${PROFILE_WIDTH - 4},${PROFILE_HEIGHT - 4} L4,${PROFILE_HEIGHT - 4} Z`}
          fill="url(#routePreviewProfileFill)"
        />
        <path
          d={profilePath}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        {stopMarkers.map(({ stop, x }) => (
          <text
            key={stop.zoneId}
            x={x}
            y={PROFILE_HEIGHT - 6}
            textAnchor="middle"
            fontSize="11"
          >
            {stop.icon}
          </text>
        ))}
        <line
          x1={marker.x}
          y1="2"
          x2={marker.x}
          y2={PROFILE_HEIGHT - 2}
          stroke="#ffffff"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.35"
        />
        <circle cx={marker.x} cy={marker.y} r="4.5" fill="#6D28D9" />
        <circle cx={marker.x} cy={marker.y} r="1.8" fill="#ffffff" />
      </svg>
    </div>
  );
}
