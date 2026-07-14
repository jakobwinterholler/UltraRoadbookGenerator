export interface SyncRaceSummary {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  companion_revision: number;
  updated_at: string | null;
  analyzed_at: string | null;
  has_bundle: boolean;
  readiness_score?: number | null;
}

export interface AuthProfile {
  id: string;
  email: string | null;
}

export interface CompanionStop {
  zoneId: number;
  km: number;
  lat: number;
  lon: number;
  name: string;
  category: string;
  categoryLabel: string;
  icon: string;
  verificationStatus: "verified" | "unverified" | "needs_review" | "pending";
  openingHours: string | null;
  notes: string | null;
  phone?: string | null;
  website?: string | null;
  /** Google Place ID for precise Maps / Street View links when available. */
  placeId?: string | null;
  hasFood?: boolean;
  hasWater?: boolean;
  hasFuel?: boolean;
  hasCoffee?: boolean;
  confidenceScore?: number | null;
  verificationDate?: string | null;
}

export interface CompanionUnsupportedSection {
  id: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  displayLabel: string;
  riskLevel: string;
  elevationGainM?: number;
  estimatedRidingHours?: number;
  waterNeededMl?: number;
  carbsNeededG?: number;
  riskBand?: "Low" | "Medium" | "High";
}

export interface CompanionDashboardStats {
  verifiedStops: number;
  unverifiedStops: number;
  remainingStops: number;
  remainingUnsupportedKm: number;
  readinessScore: number;
  readinessReasons: Array<{ kind: "pass" | "warn"; text: string }>;
}

export interface CompanionBundle {
  schemaVersion: number;
  revision?: number;
  syncedAt?: string;
  exportedAt: string;
  race: {
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number;
    analyzedAt?: string | null;
  };
  route: {
    coordinates: [number, number][];
    bounds: {
      south: number;
      west: number;
      north: number;
      east: number;
    };
  };
  stops: CompanionStop[];
  unsupportedSections: CompanionUnsupportedSection[];
  dashboardStats?: CompanionDashboardStats;
  riderAssumptions?: {
    ridingSpeedKmh: number;
    climbingPenaltyMinPer100m: number;
    waterMlPerHour: number;
    carbsGPerHour: number;
    maxGapWithoutResupplyKm: number;
  };
}

export function isCompanionBundle(value: unknown): value is CompanionBundle {
  if (!value || typeof value !== "object") {
    return false;
  }
  const bundle = value as CompanionBundle;
  return (
    typeof bundle.schemaVersion === "number" &&
    !!bundle.race?.name &&
    Array.isArray(bundle.stops) &&
    Array.isArray(bundle.route?.coordinates)
  );
}
