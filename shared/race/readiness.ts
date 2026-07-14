import {
  DEFAULT_RIDER_ASSUMPTIONS,
  type RiderAssumptions,
  unsupportedRiskBand,
} from "./riderAssumptions";

export type ReadinessReasonKind = "pass" | "warn";

export interface ReadinessReason {
  kind: ReadinessReasonKind;
  text: string;
}

export interface StopCategoryCounts {
  supermarkets: number;
  water: number;
  fuel: number;
}

export interface CategoryVerificationCounts {
  supermarkets: { total: number; verified: number };
  water: { total: number; verified: number };
  fuel: { total: number; verified: number };
}

export interface RaceReadinessInput {
  verifiedStops: number;
  unverifiedStops: number;
  categories: CategoryVerificationCounts;
  stopsMissingOpeningHours: number;
  longestUnsupportedKm: number | null;
  maxGapKm?: number;
}

export interface RaceDashboardStats {
  verified_stops: number;
  unverified_stops: number;
  supermarkets: number;
  water_stops: number;
  fuel_stops: number;
  longest_unsupported_km: number | null;
  last_verification_at: string | null;
  readiness_score: number;
  readiness_reasons: ReadinessReason[];
}

export function isSupermarketCategory(category: string): boolean {
  const lowered = category.toLowerCase();
  return (
    lowered.includes("supermarket") ||
    lowered.includes("convenience") ||
    lowered.includes("bakery") ||
    lowered === "supermarket"
  );
}

export function computeReadiness(
  input: RaceReadinessInput,
  assumptions: RiderAssumptions = DEFAULT_RIDER_ASSUMPTIONS,
): { score: number; reasons: ReadinessReason[] } {
  const reasons: ReadinessReason[] = [];
  const maxGap = input.maxGapKm ?? assumptions.maxGapWithoutResupplyKm;
  const weights = {
    supermarkets: 20,
    fuel: 20,
    water: 20,
    openingHours: 15,
    unsupported: 15,
    overallVerification: 10,
  };
  let earned = 0;

  const { supermarkets, water, fuel } = input.categories;
  const totalStops = input.verifiedStops + input.unverifiedStops;

  function ratioScore(total: number, verified: number, weight: number): number {
    if (total === 0) {
      return 0;
    }
    return (verified / total) * weight;
  }

  if (supermarkets.total === 0) {
    reasons.push({ kind: "warn", text: "No supermarket stops on route" });
  } else if (supermarkets.verified === supermarkets.total) {
    reasons.push({ kind: "pass", text: "All supermarkets verified" });
    earned += weights.supermarkets;
  } else {
    const missing = supermarkets.total - supermarkets.verified;
    reasons.push({
      kind: "warn",
      text: `${missing} supermarket${missing === 1 ? "" : "s"} not verified`,
    });
    earned += ratioScore(supermarkets.total, supermarkets.verified, weights.supermarkets);
  }

  if (fuel.total === 0) {
    reasons.push({ kind: "warn", text: "No fuel stops on route" });
  } else if (fuel.verified === fuel.total) {
    reasons.push({ kind: "pass", text: "All fuel stops verified" });
    earned += weights.fuel;
  } else {
    const missing = fuel.total - fuel.verified;
    reasons.push({
      kind: "warn",
      text: `${missing} fuel stop${missing === 1 ? "" : "s"} not verified`,
    });
    earned += ratioScore(fuel.total, fuel.verified, weights.fuel);
  }

  if (water.total === 0) {
    reasons.push({ kind: "warn", text: "No water stops on route" });
  } else if (water.verified === water.total) {
    reasons.push({ kind: "pass", text: "All water stops verified" });
    earned += weights.water;
  } else {
    const missing = water.total - water.verified;
    reasons.push({
      kind: "warn",
      text: `${missing} water stop${missing === 1 ? "" : "s"} not verified`,
    });
    earned += ratioScore(water.total, water.verified, weights.water);
  }

  if (totalStops > 0) {
    const knownHours = totalStops - input.stopsMissingOpeningHours;
    if (input.stopsMissingOpeningHours === 0) {
      reasons.push({ kind: "pass", text: "Opening hours available" });
      earned += weights.openingHours;
    } else {
      reasons.push({
        kind: "warn",
        text:
          input.stopsMissingOpeningHours === 1
            ? "1 stop with unknown opening hours"
            : `${input.stopsMissingOpeningHours} stops with unknown opening hours`,
      });
      earned += ratioScore(totalStops, knownHours, weights.openingHours);
    }
  }

  if (input.longestUnsupportedKm != null && input.longestUnsupportedKm > maxGap) {
    reasons.push({
      kind: "warn",
      text: `Unsupported section >${maxGap} km (${Math.round(input.longestUnsupportedKm)} km)`,
    });
    const excessRatio = Math.min(1, (input.longestUnsupportedKm - maxGap) / maxGap);
    earned += weights.unsupported * Math.max(0, 1 - excessRatio);
  } else if (input.longestUnsupportedKm != null) {
    reasons.push({ kind: "pass", text: "Unsupported gaps within your limit" });
    earned += weights.unsupported;
  }

  if (totalStops > 0) {
    if (input.verifiedStops === totalStops) {
      reasons.push({ kind: "pass", text: "Every resupply stop verified" });
      earned += weights.overallVerification;
    } else {
      earned += ratioScore(totalStops, input.verifiedStops, weights.overallVerification);
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(earned))), reasons };
}

export function buildDashboardStats(
  input: RaceReadinessInput & {
    lastVerificationAt: string | null;
    stopCounts: StopCategoryCounts;
  },
  assumptions?: RiderAssumptions,
): RaceDashboardStats {
  const { score, reasons } = computeReadiness(input, assumptions);
  return {
    verified_stops: input.verifiedStops,
    unverified_stops: input.unverifiedStops,
    supermarkets: input.stopCounts.supermarkets,
    water_stops: input.stopCounts.water,
    fuel_stops: input.stopCounts.fuel,
    longest_unsupported_km: input.longestUnsupportedKm,
    last_verification_at: input.lastVerificationAt,
    readiness_score: score,
    readiness_reasons: reasons,
  };
}

export function readinessScoreColor(score: number): string {
  if (score >= 85) {
    return "text-emerald-600";
  }
  if (score >= 65) {
    return "text-amber-600";
  }
  return "text-red-600";
}

export function readinessScoreBg(score: number, dark = false): string {
  if (score >= 85) {
    return dark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700";
  }
  if (score >= 65) {
    return dark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-800";
  }
  return dark ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-700";
}

export const READINESS_READY_THRESHOLD = 85;

export function isReadyToRide(score: number): boolean {
  return score >= READINESS_READY_THRESHOLD;
}

export function estimateReviewTimeSeconds(
  unverifiedStops: number,
  secondsPerStop = 30,
): number {
  return Math.max(0, unverifiedStops) * secondsPerStop;
}

export function formatReviewTime(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return "0 min";
  }
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) {
    return `~${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `~${hours}h ${remainder}m` : `~${hours}h`;
}

export { unsupportedRiskBand };
