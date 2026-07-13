import { useMemo } from "react";
import type { ClimbRow, PoiRow, ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { analyzeClimbs, type AnalyzedClimb } from "./climbAnalysis";
import { buildClimbRoadbook, climbProfilePoints, type ClimbRoadbook } from "./climbRoadbook";

export interface ClimbDetailData {
  analyzed: AnalyzedClimb;
  roadbook: ClimbRoadbook;
  profilePoints: Array<{ km: number; ele: number }>;
}

export function useClimbDetail(
  climb: ClimbRow,
  route: RouteVisualization,
  pois: PoiRow[],
  zones: ResupplyZone[],
): ClimbDetailData {
  return useMemo(() => {
    const trackPoints = route.track_points as TrackPoint[];
    return {
      analyzed: analyzeClimbs([climb])[0],
      roadbook: buildClimbRoadbook(climb, pois, zones, trackPoints),
      profilePoints: climbProfilePoints(climb, trackPoints),
    };
  }, [climb, pois, route.track_points, zones]);
}

export const GRADIENT_METRICS = [
  { label: "Hardest 50 m", key: "max_50_m_pct" as const },
  { label: "Hardest 100 m", key: "max_100_m_pct" as const },
  { label: "Hardest 250 m", key: "max_250_m_pct" as const },
  { label: "Hardest 500 m", key: "max_500_m_pct" as const },
  { label: "Hardest 1 km", key: "max_1000_m_pct" as const },
];

export function formatGradientMetric(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}
