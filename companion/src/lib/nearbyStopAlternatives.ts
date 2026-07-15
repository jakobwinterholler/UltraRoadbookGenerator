import type { CompanionStop, CompanionStopAlternative } from "@shared/types/sync";

export interface StopAlternativeView {
  key: string;
  name: string;
  category: string;
  categoryLabel: string;
  icon: string;
  distanceLabel: string;
  score: number | null;
  verificationStatus: CompanionStop["verificationStatus"];
  lat: number;
  lon: number;
  placeId?: string | null;
  isEmbedded: boolean;
  stop?: CompanionStop;
  alternative?: CompanionStopAlternative;
}

function formatDetour(distanceOffRouteM: number | undefined): string {
  if (distanceOffRouteM == null || !Number.isFinite(distanceOffRouteM)) {
    return "on route";
  }
  if (distanceOffRouteM < 50) {
    return "on route";
  }
  return `${Math.round(distanceOffRouteM)} m off route`;
}

function embeddedAlternativeView(
  alternative: CompanionStopAlternative,
): StopAlternativeView {
  return {
    key: `${alternative.osmType}-${alternative.osmId}`,
    name: alternative.name,
    category: alternative.category,
    categoryLabel: alternative.categoryLabel,
    icon: alternative.icon,
    distanceLabel: formatDetour(alternative.distanceOffRouteM),
    score: alternative.score ?? null,
    verificationStatus: alternative.verificationStatus,
    lat: alternative.lat,
    lon: alternative.lon,
    placeId: alternative.placeId,
    isEmbedded: true,
    alternative,
  };
}

function zoneAlternativeView(
  stop: CompanionStop,
  anchorKm: number,
): StopAlternativeView {
  const deltaM = Math.round(Math.abs(stop.km - anchorKm) * 1000);
  const position =
    deltaM < 75
      ? "nearby"
      : stop.km > anchorKm
        ? `${deltaM} m after`
        : `${Math.abs(deltaM)} m before`;
  return {
    key: `zone-${stop.zoneId}`,
    name: stop.name,
    category: stop.category,
    categoryLabel: stop.categoryLabel,
    icon: stop.icon,
    distanceLabel: position,
    score: stop.confidenceScore ?? null,
    verificationStatus: stop.verificationStatus,
    lat: stop.lat,
    lon: stop.lon,
    placeId: stop.placeId,
    isEmbedded: false,
    stop,
  };
}

/** Stops within this gap share a planning area for local alternatives (matches Desktop). */
export const PLANNING_AREA_KM = 12;

const MAX_ALTERNATIVES = 5;

export function buildStopAlternatives(
  anchor: CompanionStop,
  allStops: CompanionStop[],
): StopAlternativeView[] {
  const embedded = (anchor.alternatives ?? []).map(embeddedAlternativeView);
  const embeddedKeys = new Set(embedded.map((item) => item.key));

  const nearby = allStops
    .filter(
      (stop) =>
        stop.zoneId !== anchor.zoneId &&
        Math.abs(stop.km - anchor.km) <= PLANNING_AREA_KM,
    )
    .map((stop) => zoneAlternativeView(stop, anchor.km))
    .filter((item) => !embeddedKeys.has(item.key))
    .sort((left, right) => {
      const leftScore = left.score ?? 0;
      const rightScore = right.score ?? 0;
      return rightScore - leftScore;
    });

  return [...embedded, ...nearby].slice(0, MAX_ALTERNATIVES);
}

/** @deprecated Use buildStopAlternatives */
export function findNearbyStopAlternatives(
  anchor: CompanionStop,
  allStops: CompanionStop[],
): Array<{
  stop: CompanionStop;
  positionLabel: string;
  distanceM: number;
}> {
  return buildStopAlternatives(anchor, allStops)
    .filter((item) => item.stop)
    .map((item) => ({
      stop: item.stop!,
      positionLabel: item.distanceLabel,
      distanceM: Math.round(Math.abs(item.stop!.km - anchor.km) * 1000),
    }));
}
