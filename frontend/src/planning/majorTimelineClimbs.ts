import type { ClimbRow } from "../api";
import { significantClimbs } from "@shared/race/significantClimbs";

export function majorTimelineClimbs(climbs: ClimbRow[]): ClimbRow[] {
  return significantClimbs(climbs).sort((left, right) => left.start_km - right.start_km);
}

export function climbTimelineKm(climb: ClimbRow): number {
  return (climb.start_km + climb.end_km) / 2;
}
