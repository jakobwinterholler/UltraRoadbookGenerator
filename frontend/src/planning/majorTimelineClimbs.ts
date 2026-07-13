import type { ClimbRow } from "../api";
import { MAJOR_CLIMB_MIN_ELEVATION_GAIN_M } from "./timelineLayout";

export function majorTimelineClimbs(
  climbs: ClimbRow[],
  minElevationGainM = MAJOR_CLIMB_MIN_ELEVATION_GAIN_M,
): ClimbRow[] {
  return climbs
    .filter((climb) => climb.elevation_gain_m >= minElevationGainM)
    .sort((left, right) => left.start_km - right.start_km);
}

export function climbTimelineKm(climb: ClimbRow): number {
  return (climb.start_km + climb.end_km) / 2;
}
