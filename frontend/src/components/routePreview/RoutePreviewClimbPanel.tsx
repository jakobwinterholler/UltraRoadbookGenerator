import type { AnalyzedClimb } from "../../planning/climbAnalysis";
import {
  climbMaxGradientPct,
  estimateClimbRidingMinutes,
  formatRidingDuration,
} from "../../routePreview/playbackPacing";

interface RoutePreviewClimbPanelProps {
  climb: AnalyzedClimb;
  visible: boolean;
}

export default function RoutePreviewClimbPanel({ climb, visible }: RoutePreviewClimbPanelProps) {
  const maxGradient = climbMaxGradientPct(climb);
  const ridingTime = formatRidingDuration(estimateClimbRidingMinutes(climb));

  return (
    <div
      className={`pointer-events-none absolute left-3 top-3 z-20 max-w-[15rem] transition-all duration-500 md:max-w-xs ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      }`}
      aria-live="polite"
    >
      <div className="rounded-xl border border-white/12 bg-black/60 px-3.5 py-3 shadow-lg backdrop-blur-md">
        <p className="mb-2 text-sm font-medium leading-snug text-white">
          🏔 {climb.displayName}
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular-nums text-white/75">
          <div>
            <dt className="text-white/40">Distance</dt>
            <dd>{climb.length_km.toFixed(1)} km</dd>
          </div>
          <div>
            <dt className="text-white/40">Gain</dt>
            <dd>+{Math.round(climb.elevation_gain_m)} m</dd>
          </div>
          <div>
            <dt className="text-white/40">Average</dt>
            <dd>{climb.avg_gradient_pct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-white/40">Max</dt>
            <dd>{maxGradient.toFixed(1)}%</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] text-white/45">
          Est. riding time · {ridingTime}
        </p>
      </div>
    </div>
  );
}
