import { useMemo } from "react";
import type { ResupplyZone } from "../../api";
import type { VerifiedStopRecord } from "../../planning/stopVerification/types";
import { routeProgressAtTime } from "../../routePreview/core/progress";
import {
  buildMinimapProjection,
  buildRouteProfile,
  buildVerifiedStopTimeline,
  companionStateAtTime,
  formatCompanionGradient,
  routeProfileMarker,
  routeProfilePath,
} from "../../routePreview/core/companion";
import type { RoutePreviewRuntime } from "../../routePreview/core/types";

interface RoutePreviewCompanionHudProps {
  runtime: RoutePreviewRuntime;
  timeS: number;
  zones: ResupplyZone[];
  verifiedStops: Record<string, VerifiedStopRecord>;
}

const PROFILE_WIDTH = 800;
const PROFILE_HEIGHT = 56;

export default function RoutePreviewCompanionHud({
  runtime,
  timeS,
  zones,
  verifiedStops,
}: RoutePreviewCompanionHudProps) {
  const state = useMemo(() => companionStateAtTime(runtime, timeS), [runtime, timeS]);
  const profile = useMemo(() => buildRouteProfile(runtime), [runtime]);
  const marker = useMemo(
    () => routeProfileMarker(runtime, profile, state.km, PROFILE_WIDTH, PROFILE_HEIGHT),
    [runtime, profile, state.km],
  );
  const profilePath = useMemo(
    () => routeProfilePath(profile, PROFILE_WIDTH, PROFILE_HEIGHT),
    [profile],
  );

  const minimap = useMemo(() => {
    const progress = routeProgressAtTime(runtime, timeS);
    return buildMinimapProjection(
      runtime,
      state.km,
      progress.scene.kmRange.startKm,
      progress.scene.kmRange.endKm,
    );
  }, [runtime, state.km, timeS]);

  const verifiedTimeline = useMemo(
    () => buildVerifiedStopTimeline(zones, verifiedStops, state.km),
    [zones, verifiedStops, state.km],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      <div className="flex items-start justify-between gap-3 p-3 md:p-4">
        <div className="min-w-0 rounded-xl border border-black/10 bg-white/92 px-3 py-2 shadow-md backdrop-blur-sm md:px-4 md:py-3">
          <p className="truncate text-sm font-semibold text-ink md:text-base">{state.sectionTitle}</p>
          <p className="truncate text-xs text-muted md:text-sm">{state.sectionSubtitle}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {Math.round(state.pctComplete)}% complete · {Math.round(state.kmRemaining)} km left
          </p>
        </div>

        <div className="shrink-0 rounded-xl border border-black/10 bg-white/92 p-2 shadow-md backdrop-blur-sm">
          <svg
            viewBox={`0 0 ${minimap.width} ${minimap.height}`}
            className="h-20 w-20 md:h-24 md:w-24"
            aria-label="Route minimap"
          >
            <rect width={minimap.width} height={minimap.height} rx="8" fill="#f4f6f8" />
            <path
              d={minimap.pathD}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {minimap.sectionPathD ? (
              <path
                d={minimap.sectionPathD}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            ) : null}
            <circle cx={minimap.marker.x} cy={minimap.marker.y} r="5" fill="#7c3aed" />
            <circle cx={minimap.marker.x} cy={minimap.marker.y} r="2" fill="#ffffff" />
            <g
              transform={`translate(${minimap.marker.x}, ${minimap.marker.y}) rotate(${minimap.headingDeg})`}
            >
              <path d="M0,-9 L4,3 L0,0 L-4,3 Z" fill="#0f172a" opacity="0.85" />
            </g>
          </svg>
        </div>
      </div>

      <div className="mt-auto space-y-2 p-3 md:p-4">
        {verifiedTimeline.length > 0 ? (
          <div className="rounded-xl border border-black/10 bg-white/92 px-3 py-2 shadow-md backdrop-blur-sm md:px-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Verified stops
            </p>
            <ul className="space-y-1 text-xs text-ink md:text-sm">
              {verifiedTimeline.map((item) => (
                <li key={item.zoneId} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="shrink-0">
                    {item.status === "passed" ? "✓" : "○"}
                  </span>
                  <span className={item.status === "upcoming" ? "text-muted" : "font-medium"}>
                    {item.status === "passed"
                      ? item.name
                      : item.status === "current"
                        ? `Now: ${item.name}`
                        : `Next: ${item.detail ?? item.name}`}
                  </span>
                  {item.status !== "passed" && item.distanceKm !== null ? (
                    <span className="tabular-nums text-muted">({Math.round(item.distanceKm)} km)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-black/10 bg-white/92 px-3 py-2 shadow-md backdrop-blur-sm md:px-4 md:py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-ink">
              <span>
                <span className="text-muted">Done </span>
                {Math.round(state.kmDone)} km
              </span>
              <span>
                <span className="text-muted">Left </span>
                {Math.round(state.kmRemaining)} km
              </span>
              <span>
                <span className="text-muted">Elev </span>
                {Math.round(state.elevationM)} m
              </span>
              <span>
                <span className="text-muted">Grade </span>
                {formatCompanionGradient(state.gradientPct)}
                {state.inClimb ? " · climbing" : ""}
              </span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-12 w-full rounded-lg bg-[#f3f5f8] md:h-14"
            aria-label="Elevation profile"
          >
            <defs>
              <linearGradient id="companionProfileFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${profilePath} L${PROFILE_WIDTH - 4},${PROFILE_HEIGHT - 4} L4,${PROFILE_HEIGHT - 4} Z`}
              fill="url(#companionProfileFill)"
            />
            <path
              d={profilePath}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
            <line
              x1={marker.x}
              y1="0"
              x2={marker.x}
              y2={PROFILE_HEIGHT}
              stroke="#7c3aed"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.45"
            />
            <circle cx={marker.x} cy={marker.y} r="5" fill="#7c3aed" />
            <circle cx={marker.x} cy={marker.y} r="2" fill="#ffffff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
