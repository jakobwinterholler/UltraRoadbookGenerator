/** Rider-configurable planning assumptions (mirrors app planning settings). */
export interface RiderAssumptions {
  /** Flat-road cruising speed used for unsupported time estimates (km/h). */
  ridingSpeedKmh: number;
  /** Extra minutes added per 100 m climbing on unsupported sections. */
  climbingPenaltyMinPer100m: number;
  /** Water intake while riding (ml/h). */
  waterMlPerHour: number;
  /** Carbohydrate intake while riding (g/h). */
  carbsGPerHour: number;
  /** Gap length (km) above which unsupported sections raise readiness warnings. */
  maxGapWithoutResupplyKm: number;
}

export const DEFAULT_RIDER_ASSUMPTIONS: RiderAssumptions = {
  ridingSpeedKmh: 20,
  climbingPenaltyMinPer100m: 3,
  waterMlPerHour: 500,
  carbsGPerHour: 60,
  maxGapWithoutResupplyKm: 45,
};

export function estimateRidingHours(
  distanceKm: number,
  elevationGainM: number,
  assumptions: RiderAssumptions = DEFAULT_RIDER_ASSUMPTIONS,
): number {
  const baseHours = distanceKm / assumptions.ridingSpeedKmh;
  const climbHours = (elevationGainM / 100) * (assumptions.climbingPenaltyMinPer100m / 60);
  return baseHours + climbHours;
}

export function formatRidingTime(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "—";
  }
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) {
    return `${m} min`;
  }
  if (m === 0) {
    return `${h} h`;
  }
  return `${h} h ${m} min`;
}

export function estimateWaterNeededMl(
  distanceKm: number,
  elevationGainM: number,
  assumptions: RiderAssumptions = DEFAULT_RIDER_ASSUMPTIONS,
): number {
  const hours = estimateRidingHours(distanceKm, elevationGainM, assumptions);
  return Math.round(hours * assumptions.waterMlPerHour);
}

export function estimateCarbsNeededG(
  distanceKm: number,
  elevationGainM: number,
  assumptions: RiderAssumptions = DEFAULT_RIDER_ASSUMPTIONS,
): number {
  const hours = estimateRidingHours(distanceKm, elevationGainM, assumptions);
  return Math.round(hours * assumptions.carbsGPerHour);
}

export type UnsupportedRiskBand = "Low" | "Medium" | "High";

export function unsupportedRiskBand(
  distanceKm: number,
  elevationGainM: number,
  assumptions: RiderAssumptions = DEFAULT_RIDER_ASSUMPTIONS,
): UnsupportedRiskBand {
  const gapFactor = distanceKm / assumptions.maxGapWithoutResupplyKm;
  const climbFactor = elevationGainM / 1500;
  const score = gapFactor * 0.7 + climbFactor * 0.3;
  if (score >= 1.4) {
    return "High";
  }
  if (score >= 0.85) {
    return "Medium";
  }
  return "Low";
}
