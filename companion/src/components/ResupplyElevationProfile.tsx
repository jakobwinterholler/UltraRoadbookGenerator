import { useCallback, useMemo, useRef } from "react";
import { analyzeClimbDifficulty } from "@shared/race/climbDifficulty";
import type { CompanionClimb } from "@shared/types/sync";
import type { CompanionBundle } from "../types";
import { formatKm } from "../lib/utils";

const PROFILE_WIDTH = 800;
const PROFILE_HEIGHT = 48;
const PADDING = 4;

interface ProfilePoint {
  km: number;
  eleM: number;
}

interface RouteProfileData {
  points: ProfilePoint[];
  minEleM: number;
  maxEleM: number;
  totalKm: number;
}

function buildProfileFromBundle(bundle: CompanionBundle): RouteProfileData {
  const elevations = bundle.route.elevationsM;
  const coordinates = bundle.route.coordinates;
  const totalKm = bundle.race.distanceKm;

  if (!elevations?.length || elevations.length !== coordinates.length) {
    return { points: [], minEleM: 0, maxEleM: 1, totalKm };
  }

  const points: ProfilePoint[] = elevations.map((eleM, index) => ({
    km: totalKm * (index / Math.max(elevations.length - 1, 1)),
    eleM,
  }));

  const eleValues = points.map((point) => point.eleM);
  return {
    points,
    minEleM: Math.min(...eleValues),
    maxEleM: Math.max(...eleValues),
    totalKm,
  };
}

function elevationAtKm(profile: RouteProfileData, km: number): number {
  const { points } = profile;
  if (points.length === 0) {
    return 0;
  }
  if (points.length === 1) {
    return points[0].eleM;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (km >= current.km && km <= next.km) {
      const span = Math.max(0.0001, next.km - current.km);
      const blend = (km - current.km) / span;
      return current.eleM + (next.eleM - current.eleM) * blend;
    }
  }

  return points[points.length - 1].eleM;
}

function kmToX(km: number, totalKm: number, width: number, padding = PADDING): number {
  return padding + (km / Math.max(0.001, totalKm)) * (width - padding * 2);
}

function xToKm(x: number, totalKm: number, width: number, padding = PADDING): number {
  const ratio = (x - padding) / Math.max(1, width - padding * 2);
  return Math.max(0, Math.min(totalKm, ratio * totalKm));
}

function routeProfilePath(
  profile: RouteProfileData,
  width: number,
  height: number,
  padding = PADDING,
): string {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  return profile.points
    .map((point, index) => {
      const x = kmToX(point.km, profile.totalKm, width, padding);
      const y =
        height -
        padding -
        ((point.eleM - profile.minEleM) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function markerAtKm(
  profile: RouteProfileData,
  km: number,
  width: number,
  height: number,
  padding = PADDING,
) {
  const span = Math.max(1, profile.maxEleM - profile.minEleM);
  const eleM = elevationAtKm(profile, km);
  const x = kmToX(km, profile.totalKm, width, padding);
  const y = height - padding - ((eleM - profile.minEleM) / span) * (height - padding * 2);
  return { x, y, eleM, km };
}

function majorClimbs(climbs: CompanionClimb[] | undefined): CompanionClimb[] {
  return (climbs ?? []).filter((climb) => analyzeClimbDifficulty(climb).score >= 35);
}

function formatElevation(m: number): string {
  return `${Math.round(m)} m`;
}

interface ResupplyElevationProfileProps {
  bundle: CompanionBundle;
  riderKm: number;
  focusKm: number | null;
  onSelectKm?: (km: number) => void;
}

export default function ResupplyElevationProfile({
  bundle,
  riderKm,
  focusKm,
  onSelectKm,
}: ResupplyElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const profile = useMemo(() => buildProfileFromBundle(bundle), [bundle]);
  const profilePath = useMemo(
    () => routeProfilePath(profile, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile],
  );
  const riderMarker = useMemo(
    () => markerAtKm(profile, riderKm, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile, riderKm],
  );
  const focusMarker = useMemo(
    () => (focusKm != null ? markerAtKm(profile, focusKm, PROFILE_WIDTH, PROFILE_HEIGHT) : null),
    [profile, focusKm],
  );

  const climbHighlights = useMemo(
    () =>
      majorClimbs(bundle.climbs).map((climb) => {
        const tier = analyzeClimbDifficulty(climb);
        const x1 = kmToX(climb.startKm, profile.totalKm, PROFILE_WIDTH);
        const x2 = kmToX(climb.endKm, profile.totalKm, PROFILE_WIDTH);
        return {
          climb,
          tier,
          x: Math.min(x1, x2),
          width: Math.max(2, Math.abs(x2 - x1)),
        };
      }),
    [bundle.climbs, profile.totalKm],
  );

  const visibleClimbs = useMemo(() => {
    if (!focusKm && !riderKm) {
      return climbHighlights.slice(0, 3);
    }
    const windowStart = Math.min(riderKm, focusKm ?? riderKm) - 15;
    const windowEnd = Math.max(riderKm, focusKm ?? riderKm) + 15;
    const nearby = climbHighlights.filter(
      (item) => item.climb.endKm >= windowStart && item.climb.startKm <= windowEnd,
    );
    return nearby.length > 0 ? nearby : climbHighlights.slice(0, 2);
  }, [climbHighlights, focusKm, riderKm]);

  const stopMarkers = useMemo(
    () =>
      bundle.stops.map((stop) => ({
        stop,
        marker: markerAtKm(profile, stop.km, PROFILE_WIDTH, PROFILE_HEIGHT),
      })),
    [bundle.stops, profile],
  );

  const handleProfileTap = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!onSelectKm || !svgRef.current) {
        return;
      }
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * PROFILE_WIDTH;
      const km = xToKm(x, profile.totalKm, PROFILE_WIDTH);
      onSelectKm(km);
    },
    [onSelectKm, profile.totalKm],
  );

  if (profile.points.length === 0) {
    return null;
  }

  const showFocusMarker =
    focusMarker != null && Math.abs(focusMarker.km - riderMarker.km) > 0.3;

  return (
    <div className="border-b border-white/8 bg-[#0a0a0a] px-4 pb-3 pt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] tabular-nums text-white/40">
        <span>0 km</span>
        <span>{formatKm(profile.totalKm)} finish</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-12 w-full cursor-pointer rounded-lg bg-[#0f1117] touch-manipulation"
        aria-label="Elevation profile — tap to jump to section"
        onPointerUp={handleProfileTap}
      >
        <defs>
          <linearGradient id="resupplyProfileFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {climbHighlights.map(({ climb, tier, x, width }) => (
          <rect
            key={climb.id}
            x={x}
            y="1"
            width={width}
            height={PROFILE_HEIGHT - 2}
            fill={tier.color}
            opacity="0.18"
            rx="1"
          />
        ))}

        <path
          d={`${profilePath} L${PROFILE_WIDTH - PADDING},${PROFILE_HEIGHT - PADDING} L${PADDING},${PROFILE_HEIGHT - PADDING} Z`}
          fill="url(#resupplyProfileFill)"
        />
        <path
          d={profilePath}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {stopMarkers.map(({ stop, marker }) => (
          <circle
            key={stop.zoneId}
            cx={marker.x}
            cy={PROFILE_HEIGHT - 3}
            r="1.5"
            fill="#64748b"
            opacity="0.55"
          />
        ))}

        {showFocusMarker ? (
          <g className="profile-marker profile-marker--focus">
            <line
              x1={focusMarker!.x}
              y1="2"
              x2={focusMarker!.x}
              y2={PROFILE_HEIGHT - 2}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.45"
            />
            <circle cx={focusMarker!.x} cy={focusMarker!.y} r="4.5" fill="#f59e0b" />
            <circle cx={focusMarker!.x} cy={focusMarker!.y} r="1.8" fill="#ffffff" />
          </g>
        ) : null}

        <g className="profile-marker profile-marker--rider">
          <line
            x1={riderMarker.x}
            y1="2"
            x2={riderMarker.x}
            y2={PROFILE_HEIGHT - 2}
            stroke="#0ea5e9"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.45"
          />
          <circle cx={riderMarker.x} cy={riderMarker.y} r="4.5" fill="#0ea5e9" />
          <circle cx={riderMarker.x} cy={riderMarker.y} r="1.8" fill="#ffffff" />
        </g>
      </svg>

      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-1 text-[10px] tabular-nums text-white/50">
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
          GPS {formatKm(riderMarker.km)} · {formatElevation(riderMarker.eleM)}
        </span>
        {showFocusMarker ? (
          <span>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Stop {formatKm(focusMarker!.km)} · {formatElevation(focusMarker!.eleM)}
          </span>
        ) : null}
      </div>

      {visibleClimbs.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/40">
          {visibleClimbs.map(({ climb, tier }) => (
            <span key={climb.id} className="tabular-nums">
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-sm"
                style={{ backgroundColor: tier.color }}
                aria-hidden
              />
              {climb.name || "Climb"} · +{climb.elevationGainM} m · {climb.avgGradientPct.toFixed(1)}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
