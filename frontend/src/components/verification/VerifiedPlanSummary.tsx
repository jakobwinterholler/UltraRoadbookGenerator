import { Fragment } from "react";
import type { VerifiedPlan } from "../../planning/stopVerification/verifiedPlan";
import {
  gapAvailabilityClass,
  gapAvailabilityLabel,
} from "../../planning/stopVerification/verifiedPlan";
import { formatRidingTime, estimateRidingHours } from "@shared/race/riderAssumptions";
import { analyzeRouteSegmentDifficulty } from "@shared/race/routeSegmentDifficulty";
import VerificationStatusIcon from "./VerificationStatusIcon";

interface VerifiedPlanSummaryProps {
  plan: VerifiedPlan;
}

function GapBlock({
  gap,
  isWeakest,
}: {
  gap: VerifiedPlan["gaps"][number];
  isWeakest: boolean;
}) {
  const elevationLossM = gap.elevationLossM ?? 0;
  const ridingTimeHours =
    gap.ridingTimeHours ??
    estimateRidingHours(gap.distanceKm, gap.elevationGainM);
  const difficulty = analyzeRouteSegmentDifficulty({
    distanceKm: gap.distanceKm,
    elevationGainM: gap.elevationGainM,
    elevationLossM,
    ridingTimeHours,
  });

  return (
    <div
      className={`my-1 border-l-2 py-2 pl-4 ${
        isWeakest ? "border-l-amber-500 bg-amber-50/50" : "border-line/80"
      }`}
      style={!isWeakest ? { borderLeftColor: difficulty.color } : undefined}
    >
      <div className="flex items-center gap-2 text-xs text-muted">
        <span aria-hidden>↓</span>
        {isWeakest && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
            Weakest gap
          </span>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <Metric label="Distance" value={`${gap.distanceKm} km`} />
        <Metric label="Elevation gain" value={`+${gap.elevationGainM} m`} />
        <Metric label="Elevation loss" value={`−${elevationLossM} m`} />
        <Metric label="Riding time" value={formatRidingTime(ridingTimeHours)} />
        <Metric
          label="Difficulty"
          value={difficulty.label}
          valueClass=""
          style={{ color: difficulty.color }}
        />
        <Metric label="Gravel" value={`${gap.gravelPct}%`} />
        <Metric
          label="Food"
          value={gapAvailabilityLabel(gap.foodAvailability)}
          valueClass={gapAvailabilityClass(gap.foodAvailability)}
        />
        <Metric
          label="Water"
          value={gapAvailabilityLabel(gap.waterAvailability)}
          valueClass={gapAvailabilityClass(gap.waterAvailability)}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-ink",
  style,
}: {
  label: string;
  value: string;
  valueClass?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className={`font-medium tabular-nums ${valueClass}`} style={style}>
        {value}
      </p>
    </div>
  );
}

export default function VerifiedPlanSummary({ plan }: VerifiedPlanSummaryProps) {
  if (plan.stops.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-ink">Verified stop summary</h3>
        <p className="mt-3 rounded-xl bg-canvas/80 px-4 py-6 text-center text-sm text-muted">
          No verified stops yet. Start your first round to build your plan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink">Verified stop summary</h3>
      <div className="mt-3 space-y-0">
        {plan.stops.map((stop, index) => {
          const gapBefore = index > 0 ? plan.gaps[index] : null;
          return (
            <Fragment key={stop.zoneId}>
              {gapBefore && (
                <GapBlock
                  gap={gapBefore}
                  isWeakest={plan.weakestGap?.id === gapBefore.id}
                />
              )}
              <div className="flex items-center gap-2 py-2">
                <VerificationStatusIcon status="verified" size="sm" />
                <span className="text-base font-semibold text-ink">{stop.name}</span>
                <span className="text-xs tabular-nums text-muted">{stop.km} km</span>
              </div>
            </Fragment>
          );
        })}

        {plan.gaps.length > plan.stops.length && (
          <GapBlock
            gap={plan.gaps[plan.gaps.length - 1]!}
            isWeakest={plan.weakestGap?.id === plan.gaps[plan.gaps.length - 1]!.id}
          />
        )}
      </div>
    </div>
  );
}
