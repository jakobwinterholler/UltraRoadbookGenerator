import type { CompanionBundle, CompanionStop, CompanionStopAlternative } from "@shared/types/sync";

export interface BundlePoiEntry {
  poiId: string;
  role: "primary" | "alternative";
  parentZoneId: number;
  stop: CompanionStop;
}

function alternativeToStop(
  anchor: CompanionStop,
  alternative: CompanionStopAlternative,
): CompanionStop {
  return {
    ...anchor,
    poiId: alternative.poiId ?? anchor.poiId,
    osmId: alternative.osmId,
    osmType: alternative.osmType,
    km: alternative.distanceAlongKm ?? anchor.km,
    lat: alternative.lat,
    lon: alternative.lon,
    name: alternative.name,
    category: alternative.category,
    categoryLabel: alternative.categoryLabel,
    icon: alternative.icon,
    distanceOffRouteM: alternative.distanceOffRouteM,
    verificationStatus: alternative.verificationStatus,
    openingHours: alternative.openingHours,
    notes: null,
    phone: alternative.phone,
    website: alternative.website,
    placeId: alternative.placeId,
    hasFood: alternative.hasFood,
    hasWater: alternative.hasWater,
    hasFuel: alternative.hasFuel,
    confidenceScore: alternative.confidenceScore ?? alternative.score ?? null,
    alternatives: [],
    nearbyAlternatives: [],
  };
}

/** Every POI exported in the bundle — primary stops plus embedded alternatives. */
export function collectAllBundlePois(bundle: CompanionBundle): BundlePoiEntry[] {
  const seen = new Set<string>();
  const entries: BundlePoiEntry[] = [];

  for (const stop of bundle.stops) {
    const primaryKey = stop.poiId ?? `zone-${stop.zoneId}`;
    if (!seen.has(primaryKey)) {
      seen.add(primaryKey);
      entries.push({
        poiId: primaryKey,
        role: "primary",
        parentZoneId: stop.zoneId,
        stop,
      });
    }

    const alternatives = stop.alternatives ?? stop.nearbyAlternatives ?? [];
    for (const alternative of alternatives) {
      const altKey =
        alternative.poiId ??
        (alternative.osmId != null
          ? `${alternative.osmType ?? "node"}-${alternative.osmId}`
          : `${primaryKey}-alt-${alternative.name}`);
      if (seen.has(altKey)) {
        continue;
      }
      seen.add(altKey);
      entries.push({
        poiId: altKey,
        role: "alternative",
        parentZoneId: stop.zoneId,
        stop: alternativeToStop(stop, alternative),
      });
    }
  }

  return entries;
}

export function findBundlePoi(bundle: CompanionBundle, needle: string): BundlePoiEntry[] {
  const normalized = needle.trim().toLowerCase();
  return collectAllBundlePois(bundle).filter((entry) =>
    entry.stop.name.toLowerCase().includes(normalized),
  );
}
