import { memo, useCallback, useMemo, useRef } from "react";
import { analyzeClimbDifficulty } from "@shared/race/climbDifficulty";
import type { CompanionClimb } from "@shared/types/sync";
import type { CompanionBundle } from "../types";
import { formatKm } from "../lib/utils";

const PROFILE_WIDTH = 800;
const PROFILE_HEIGHT = 48;
const PADDING = 4;
const MAX_PROFILE_POINTS = 600;

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

function decimateProfilePoints(points: ProfilePoint[], maxPoints: number): ProfilePoint[] {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = Math.ceil(points.length / maxPoints);
  const decimated: ProfilePoint[] = [];
  for (let index = 0; index < points.length; index += step) {
    decimated.push(points[index]);
  }
  const last = points[points.length - 1];
  if (decimated[decimated.length - 1]?.km !== last.km) {
    decimated.push(last);
  }
  return decimated;
}

function buildProfileFromBundle(bundle: CompanionBundle): RouteProfileData {
  const elevations = bundle.route.elevationsM;
  const coordinates = bundle.route.coordinates;
  const totalKm = bundle.race.distanceKm;

  if (!elevations?.length || elevations.length !== coordinates.length) {
    return { points: [], minEleM: 0, maxEleM: 1, totalKm };
  }

  const rawPoints: ProfilePoint[] = elevations.map((eleM, index) => ({
    km: totalKm * (index / Math.max(elevations.length - 1, 1)),
    eleM,
  }));
  const points = decimateProfilePoints(rawPoints, MAX_PROFILE_POINTS);

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

function formatElevation(m: number): string {
  return `${Math.round(m)} m`;
}

interface ClimbBand {
  climb: CompanionClimb;
  tier: ReturnType<typeof analyzeClimbDifficulty>;
  x: number;
  width: number;
}

interface ResupplyElevationProfileProps {
  bundle: CompanionBundle;
  riderKm: number;
  nextStopKm: number | null;
  viewportStartKm: number | null;
  viewportEndKm: number | null;
  onSelectKm?: (km: number) => void;
}

const StaticProfileLayers = memo(function StaticProfileLayers({
  profilePath,
  climbBands,
  stopMarkers,
}: {
  profilePath: string;
  climbBands: ClimbBand[];
  stopMarkers: Array<{ zoneId: number; x: number }>;
}) {
  return (
    <>
      {climbBands.map(({ climb, tier, x, width }) => (
        <rect
          key={climb.id}
          x={x}
          y="1"
          width={width}
          height={PROFILE_HEIGHT - 2}
          fill={tier.color}
          opacity="0.16"
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

      {stopMarkers.map(({ zoneId, x }) => (
        <g key={zoneId}>
          <line
            x1={x}
            y1={PROFILE_HEIGHT - 8}
            x2={x}
            y2={PROFILE_HEIGHT - 1}
            stroke="#64748b"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <circle cx={x} cy={PROFILE_HEIGHT - 2} r="1.75" fill="#94a3b8" opacity="0.75" />
        </g>
      ))}
    </>
  );
});

export default function ResupplyElevationProfile({
  bundle,
  riderKm,
  nextStopKm,
  viewportStartKm,
  viewportEndKm,
  onSelectKm,
}: ResupplyElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const profile = useMemo(() => buildProfileFromBundle(bundle), [bundle]);
  const profilePath = useMemo(
    () => routeProfilePath(profile, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile],
  );

  const climbBands = useMemo(
    () =>
      (bundle.climbs ?? []).map((climb) => {
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

  const stopMarkers = useMemo(
    () =>
      bundle.stops.map((stop) => ({
        zoneId: stop.zoneId,
        x: kmToX(stop.km, profile.totalKm, PROFILE_WIDTH),
      })),
    [bundle.stops, profile.totalKm],
  );

  const riderMarker = useMemo(
    () => markerAtKm(profile, riderKm, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile, riderKm],
  );

  const nextStopMarker = useMemo(
    () =>
      nextStopKm != null && Math.abs(nextStopKm - riderKm) > 0.3
        ? markerAtKm(profile, nextStopKm, PROFILE_WIDTH, PROFILE_HEIGHT)
        : null,
    [nextStopKm, profile, riderKm],
  );

  const viewportBand = useMemo(() => {
    if (viewportStartKm == null || viewportEndKm == null || viewportEndKm <= viewportStartKm) {
      return null;
    }
    const x1 = kmToX(viewportStartKm, profile.totalKm, PROFILE_WIDTH);
    const x2 = kmToX(viewportEndKm, profile.totalKm, PROFILE_WIDTH);
    return {
      x: Math.min(x1, x2),
      width: Math.max(4, Math.abs(x2 - x1)),
      startKm: viewportStartKm,
      endKm: viewportEndKm,
    };
  }, [profile.totalKm, viewportEndKm, viewportStartKm]);

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

        <StaticProfileLayers
          profilePath={profilePath}
          climbBands={climbBands}
          stopMarkers={stopMarkers}
        />

        {viewportBand ? (
          <rect
            x={viewportBand.x}
            y="1"
            width={viewportBand.width}
            height={PROFILE_HEIGHT - 2}
            fill="#38bdf8"
            opacity="0.12"
            rx="1"
            style={{ transition: "x 180ms ease-out, width 180ms ease-out" }}
          />
        ) : null}

        {nextStopMarker ? (
          <g className="profile-marker profile-marker--next">
            <line
              x1={nextStopMarker.x}
              y1="2"
              x2={nextStopMarker.x}
              y2={PROFILE_HEIGHT - 2}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle cx={nextStopMarker.x} cy={nextStopMarker.y} r="4" fill="#f59e0b" />
            <circle cx={nextStopMarker.x} cy={nextStopMarker.y} r="1.6" fill="#ffffff" />
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
            opacity="0.5"
          />
          <circle cx={riderMarker.x} cy={riderMarker.y} r="4" fill="#0ea5e9" />
          <circle cx={riderMarker.x} cy={riderMarker.y} r="1.6" fill="#ffffff" />
        </g>
      </svg>

      <div className="mt-1.5 flex flex-wrap items-start gap-x-4 gap-y-1 text-[10px] tabular-nums text-white/50">
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
          GPS {formatKm(riderMarker.km)} · {formatElevation(riderMarker.eleM)}
        </span>
        {nextStopMarker ? (
          <span>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Next {formatKm(nextStopMarker.km)}
          </span>
        ) : null}
        {viewportBand ? (
          <span>
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-sm bg-sky-400/70"
              aria-hidden
            />
            View {formatKm(viewportBand.startKm)}–{formatKm(viewportBand.endKm)}
          </span>
        ) : null}
      </div>

      {climbBands.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/40">
          {climbBands.slice(0, 4).map(({ climb, tier }) => (
            <span key={climb.id} className="tabular-nums">
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-sm"
                style={{ backgroundColor: tier.color }}
                aria-hidden
              />
              {climb.name || "Climb"} · +{climb.elevationGainM} m
            </span>
          ))}
          {climbBands.length > 4 ? (
            <span className="text-white/30">+{climbBands.length - 4} more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
