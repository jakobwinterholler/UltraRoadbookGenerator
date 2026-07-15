/** Shared climb significance rules for Desktop, Companion, and analysis export. */

export interface SignificantClimbMetrics {
  length_km?: number;
  lengthKm?: number;
  elevation_gain_m?: number;
  elevationGainM?: number;
  avg_gradient_pct?: number;
  avgGradientPct?: number;
  max_50_m_pct?: number | null;
  max_100_m_pct?: number | null;
  max_250_m_pct?: number | null;
  max_500_m_pct?: number | null;
  max_1000_m_pct?: number | null;
  max50mPct?: number | null;
  max100mPct?: number | null;
  max250mPct?: number | null;
  max500mPct?: number | null;
  max1000mPct?: number | null;
}

function climbLengthKm(climb: SignificantClimbMetrics): number {
  return climb.length_km ?? climb.lengthKm ?? 0;
}

function climbGainM(climb: SignificantClimbMetrics): number {
  return climb.elevation_gain_m ?? climb.elevationGainM ?? 0;
}

function climbAvgGradientPct(climb: SignificantClimbMetrics): number {
  return climb.avg_gradient_pct ?? climb.avgGradientPct ?? 0;
}

function climbMaxGradientPct(climb: SignificantClimbMetrics): number {
  const values = [
    climb.max_50_m_pct ?? climb.max50mPct,
    climb.max_100_m_pct ?? climb.max100mPct,
    climb.max_250_m_pct ?? climb.max250mPct,
    climb.max_500_m_pct ?? climb.max500mPct,
    climb.max_1000_m_pct ?? climb.max1000mPct,
  ].filter((value): value is number => value != null && Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : 0;
}

/**
 * A climb is significant when total gain and length matter to riders,
 * not when a short GPX bump barely clears minimum detector thresholds.
 */
export function isSignificantClimb(climb: SignificantClimbMetrics): boolean {
  const gainM = climbGainM(climb);
  const lengthKm = climbLengthKm(climb);
  const avgGradientPct = climbAvgGradientPct(climb);
  const maxGradientPct = climbMaxGradientPct(climb);

  if (gainM < 100) {
    return false;
  }
  if (lengthKm < 2 && gainM < 150) {
    return false;
  }
  if (gainM >= 200) {
    return true;
  }
  if (lengthKm >= 5 && gainM >= 150 && (avgGradientPct >= 2.5 || maxGradientPct >= 6)) {
    return true;
  }
  if (lengthKm >= 3 && gainM >= 120 && maxGradientPct >= 5) {
    return true;
  }
  return false;
}

export function significantClimbs<T extends SignificantClimbMetrics>(climbs: T[]): T[] {
  return climbs.filter(isSignificantClimb);
}
