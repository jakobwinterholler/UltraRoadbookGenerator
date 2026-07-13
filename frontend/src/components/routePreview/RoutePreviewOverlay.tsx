import type { OverlayFrameState } from "../../routePreview/core/types";
import {
  buildClimbProfile,
  profileMarker,
  profilePath,
} from "../../routePreview/core/climbProfile";
import { formatGradient } from "../../routePreview/core/math";
import type { RoutePreviewRuntime } from "../../routePreview/core/types";

interface RoutePreviewOverlayProps {
  runtime: RoutePreviewRuntime;
  overlay: OverlayFrameState;
}

const PROFILE_WIDTH = 1124;
const PROFILE_HEIGHT = 54;

export default function RoutePreviewOverlay({ runtime, overlay }: RoutePreviewOverlayProps) {
  const card = overlay.content;
  const strip = overlay.climbStrip;
  const climbProfile = buildClimbProfile(runtime);
  const marker =
    climbProfile && strip
      ? profileMarker(climbProfile, strip.distIntoKm, PROFILE_WIDTH, PROFILE_HEIGHT)
      : null;
  const linePath = climbProfile ? profilePath(climbProfile, PROFILE_WIDTH, PROFILE_HEIGHT) : "";

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: overlay.inTransition ? 0.7 : 0.45,
          background: overlay.inTransition
            ? "radial-gradient(ellipse at center, rgba(255,255,255,0) 45%, rgba(228,235,242,0.75) 100%)"
            : "radial-gradient(ellipse at center, rgba(255,255,255,0) 62%, rgba(228,235,242,0.28) 100%)",
        }}
      />

      {card && overlay.visible ? (
        <div
          className="absolute bottom-[14%] left-[4%] max-w-[min(480px,40vw)] rounded-2xl border border-black/[0.06] bg-white/88 px-6 py-5 text-ink shadow-lg backdrop-blur-md transition-all duration-700 md:px-7 md:py-6"
          style={{
            opacity: overlay.opacity,
            transform: `translateY(${overlay.translateY}px)`,
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            {card.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink md:text-2xl">
            {card.name}
          </h2>
          <div className="mt-3 space-y-0.5 text-base leading-snug text-ink/90">
            {card.statsLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          {card.waterValue ? (
            <p className="mt-3 text-sm text-muted">
              <span className="font-medium text-ink/80">{card.waterLabel ?? "Last verified water"}:</span>{" "}
              {card.waterValue}
            </p>
          ) : card.narrative ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{card.narrative}</p>
          ) : null}
        </div>
      ) : null}

      {strip?.visible && climbProfile && marker ? (
        <div
          className="absolute bottom-6 left-1/2 w-[min(1180px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-black/[0.06] bg-white/90 px-5 py-3 text-ink shadow-lg backdrop-blur-md transition-opacity duration-700 md:px-6 md:py-4"
          style={{ opacity: strip.opacity }}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm md:text-base">
              <span className="font-semibold text-ink">{runtime.featuredClimb?.name}</span>
              <span className="text-muted">
                {strip.distIntoKm.toFixed(1)} km in · +{Math.round(strip.gainedM)} m ·{" "}
                {formatGradient(strip.gradientPct)}
              </span>
            </div>
            {strip.lastVerifiedWater ? (
              <p className="text-xs text-muted md:text-sm">
                Last water: {strip.lastVerifiedWater.poiName}, km {strip.lastVerifiedWater.km}
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl bg-[#f3f5f8] px-1 py-1">
            <svg
              viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
              preserveAspectRatio="none"
              className="block h-12 w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="climbProfileGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${linePath} L${PROFILE_WIDTH - 6},${PROFILE_HEIGHT - 6} L6,${PROFILE_HEIGHT - 6} Z`}
                fill="url(#climbProfileGradient)"
              />
              <path
                d={linePath}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.75"
              />
              <line
                x1="0"
                y1={PROFILE_HEIGHT - 6}
                x2={PROFILE_WIDTH}
                y2={PROFILE_HEIGHT - 6}
                stroke="rgba(15,23,42,0.08)"
                strokeWidth="1"
              />
              <circle cx={marker.x} cy={marker.y} r="5" fill="#7c3aed" />
              <circle cx={marker.x} cy={marker.y} r="2.5" fill="#ffffff" />
            </svg>
          </div>
        </div>
      ) : null}
    </div>
  );
}
