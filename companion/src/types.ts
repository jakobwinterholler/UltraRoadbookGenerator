export const COMPANION_SCHEMA_VERSION = 1;

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
  exportedAt: string;
  race: {
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number;
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

export type ResupplyTimelineEntry =
  | {
      kind: "stop";
      km: number;
      stop: CompanionStop;
    }
  | {
      kind: "unsupported";
      km: number;
      section: CompanionUnsupportedSection;
    };

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
