export interface SyncRaceSummary {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  companion_revision: number;
  updated_at: string | null;
  analyzed_at: string | null;
  has_bundle: boolean;
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
  verificationStatus: "verified" | "unverified";
  openingHours: string | null;
  notes: string | null;
}

export interface CompanionUnsupportedSection {
  id: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  displayLabel: string;
  riskLevel: string;
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
