import { analyzeRouteSegmentDifficulty } from "@shared/race/routeSegmentDifficulty";
import { estimateRidingHours, formatRidingTime } from "@shared/race/riderAssumptions";
import type { TrackPoint } from "../../api";
import { formatKm } from "../routeInsights";
import { elevationGainInKmRange } from "../../planning/resupplyGaps";
import { elevationLossInKmRange } from "../../planning/unsupportedSections";

export interface RouteSegmentGapMetrics {
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  ridingTimeHours: number;
  difficultyColor: string;
  difficultyLabel: string;
}

export function buildRouteSegmentGapMetrics(
  trackPoints: TrackPoint[],
  startKm: number,
  endKm: number,
): RouteSegmentGapMetrics {
  const distanceKm = Math.max(0, endKm - startKm);
  const elevationGainM = elevationGainInKmRange(trackPoints, startKm, endKm);
  const elevationLossM = elevationLossInKmRange(trackPoints, startKm, endKm);
  const ridingTimeHours = estimateRidingHours(distanceKm, elevationGainM);
  const difficulty = analyzeRouteSegmentDifficulty({
    distanceKm,
    elevationGainM,
    elevationLossM,
    ridingTimeHours,
  });

  return {
    startKm,
    endKm,
    distanceKm,
    elevationGainM,
    elevationLossM,
    ridingTimeHours,
    difficultyColor: difficulty.color,
    difficultyLabel: difficulty.label,
  };
}

interface RouteSegmentGapRowProps {
  metrics: RouteSegmentGapMetrics;
  compact?: boolean;
}

export default function RouteSegmentGapRow({ metrics, compact = false }: RouteSegmentGapRowProps) {
  return (
    <div
      className={`border-l-2 py-2 pl-3 ${compact ? "my-0.5" : "my-1"}`}
      style={{ borderLeftColor: metrics.difficultyColor }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-muted">
        <span className="font-medium text-ink">{formatKm(metrics.distanceKm, 0)}</span>
        <span aria-hidden>·</span>
        <span>+{metrics.elevationGainM.toLocaleString()} m</span>
        <span aria-hidden>·</span>
        <span>−{metrics.elevationLossM.toLocaleString()} m</span>
        <span aria-hidden>·</span>
        <span>{formatRidingTime(metrics.ridingTimeHours)}</span>
        <span aria-hidden>·</span>
        <span style={{ color: metrics.difficultyColor }}>{metrics.difficultyLabel}</span>
      </div>
    </div>
  );
}
