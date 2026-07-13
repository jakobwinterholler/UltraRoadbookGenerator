import type { ResupplyZone, RouteVisualization, TrackPoint } from "../api";
import { elevationGainInKmRange } from "./resupplyGaps";

const RELIABLE_FOOD_SCORE = 35;
const RELIABLE_WATER_SCORE = 10;
const MIN_DISTANCE_KM = 10;
const MIN_GAIN_M = 500;
const SIGNIFICANT_GRAVEL_PCT = 20;
const MIN_GRAVEL_DISTANCE_KM = 5;

export type UnsupportedRiskLevel = "low" | "moderate" | "high" | "critical" | "extreme";

export type AvailabilityLevel = "none" | "limited" | "available";

export interface UnsupportedStopRef {
  name: string;
  km: number;
  zoneId: number;
}

export interface UnsupportedWhyBadge {
  id: string;
  emoji: string;
  label: string;
  shortLabel: string;
}

export interface UnsupportedSection {
  id: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  gravelPct: number;
  avgGradientPct: number | null;
  waterAvailability: AvailabilityLevel;
  foodAvailability: AvailabilityLevel;
  stopBefore: UnsupportedStopRef | null;
  stopAfter: UnsupportedStopRef | null;
  reliableFoodBefore: UnsupportedStopRef | null;
  reliableFoodAfter: UnsupportedStopRef | null;
  reliableWaterBefore: UnsupportedStopRef | null;
  reliableWaterAfter: UnsupportedStopRef | null;
  riskLevel: UnsupportedRiskLevel;
  riskScore: number;
  riskRank: number | null;
  whyBadges: UnsupportedWhyBadge[];
  displayLabel: string;
  isRemote: boolean;
}

export interface UnsupportedRiskTier {
  level: UnsupportedRiskLevel;
  label: string;
  stars: 1 | 2 | 3 | 4 | 5;
  badgeClass: string;
  accentClass: string;
  starClass: string;
}

const RISK_TIERS: Array<{ minScore: number; tier: UnsupportedRiskTier }> = [
  {
    minScore: 80,
    tier: {
      level: "extreme",
      label: "Extreme",
      stars: 5,
      badgeClass: "bg-red-100 text-red-900 ring-red-200",
      accentClass: "hover:border-red-300/80",
      starClass: "text-red-600",
    },
  },
  {
    minScore: 65,
    tier: {
      level: "critical",
      label: "Critical",
      stars: 4,
      badgeClass: "bg-orange-100 text-orange-900 ring-orange-200",
      accentClass: "hover:border-orange-300/80",
      starClass: "text-orange-600",
    },
  },
  {
    minScore: 50,
    tier: {
      level: "high",
      label: "High",
      stars: 3,
      badgeClass: "bg-amber-100 text-amber-900 ring-amber-200",
      accentClass: "hover:border-amber-300/80",
      starClass: "text-amber-600",
    },
  },
  {
    minScore: 35,
    tier: {
      level: "moderate",
      label: "Moderate",
      stars: 2,
      badgeClass: "bg-yellow-100 text-yellow-900 ring-yellow-200",
      accentClass: "hover:border-yellow-300/80",
      starClass: "text-yellow-700",
    },
  },
  {
    minScore: 0,
    tier: {
      level: "low",
      label: "Low",
      stars: 1,
      badgeClass: "bg-slate-100 text-slate-700 ring-slate-200",
      accentClass: "hover:border-line/80",
      starClass: "text-slate-500",
    },
  },
];

export function zoneHasReliableFood(zone: ResupplyZone): boolean {
  const group = zone.categories.find((item) => item.key === "food");
  return group?.primary != null && group.primary.score >= RELIABLE_FOOD_SCORE;
}

export function zoneHasReliableWater(zone: ResupplyZone): boolean {
  const group = zone.categories.find((item) => item.key === "water");
  return group?.primary != null && group.primary.score >= RELIABLE_WATER_SCORE;
}

function zoneHasAnyFood(zone: ResupplyZone): boolean {
  return zone.categories.some((item) => item.key === "food" && item.primary !== null);
}

function zoneHasAnyWater(zone: ResupplyZone): boolean {
  return zone.categories.some((item) => item.key === "water" && item.primary !== null);
}

function stopRef(zone: ResupplyZone): UnsupportedStopRef {
  return { name: zone.name, km: zone.distance_along_km, zoneId: zone.zone_id };
}

export function elevationLossInKmRange(points: TrackPoint[], startKm: number, endKm: number): number {
  const inRange = points.filter((point) => point.km >= startKm && point.km <= endKm);
  if (inRange.length < 2) {
    return 0;
  }

  let loss = 0;
  for (let index = 1; index < inRange.length; index += 1) {
    const previous = inRange[index - 1].ele_m;
    const current = inRange[index].ele_m;
    if (previous !== null && current !== null && current < previous) {
      loss += previous - current;
    }
  }
  return Math.round(loss);
}

export function gravelPctInKmRange(route: RouteVisualization, startKm: number, endKm: number): number {
  const distanceKm = Math.max(endKm - startKm, 0.001);
  let gravelKm = 0;

  for (const segment of route.surface_segments) {
    if (segment.end_km <= startKm || segment.start_km >= endKm) {
      continue;
    }
    const category = segment.rider_category ?? segment.surface;
    if (category !== "Gravel") {
      continue;
    }
    const overlapStart = Math.max(segment.start_km, startKm);
    const overlapEnd = Math.min(segment.end_km, endKm);
    gravelKm += Math.max(0, overlapEnd - overlapStart);
  }

  return Math.round((gravelKm / distanceKm) * 100);
}

function availabilityInRange(
  zones: ResupplyZone[],
  startKm: number,
  endKm: number,
  reliableCheck: (zone: ResupplyZone) => boolean,
  anyCheck: (zone: ResupplyZone) => boolean,
): AvailabilityLevel {
  const inside = zones.filter(
    (zone) => zone.distance_along_km > startKm && zone.distance_along_km < endKm,
  );
  if (inside.some(reliableCheck)) {
    return "available";
  }
  if (inside.some(anyCheck)) {
    return "limited";
  }
  return "none";
}

function findReliableStopBefore(
  zones: ResupplyZone[],
  km: number,
  check: (zone: ResupplyZone) => boolean,
): UnsupportedStopRef | null {
  const candidates = zones
    .filter((zone) => zone.distance_along_km <= km && check(zone))
    .sort((left, right) => right.distance_along_km - left.distance_along_km);
  return candidates[0] ? stopRef(candidates[0]) : null;
}

function findReliableStopAfter(
  zones: ResupplyZone[],
  km: number,
  check: (zone: ResupplyZone) => boolean,
): UnsupportedStopRef | null {
  const candidates = zones
    .filter((zone) => zone.distance_along_km >= km && check(zone))
    .sort((left, right) => left.distance_along_km - right.distance_along_km);
  return candidates[0] ? stopRef(candidates[0]) : null;
}

function buildZoneGaps(
  zones: ResupplyZone[],
  totalKm: number,
): Array<{ startKm: number; endKm: number; stopBefore: UnsupportedStopRef | null; stopAfter: UnsupportedStopRef | null }> {
  const sorted = [...zones].sort((left, right) => left.distance_along_km - right.distance_along_km);
  const gaps: Array<{
    startKm: number;
    endKm: number;
    stopBefore: UnsupportedStopRef | null;
    stopAfter: UnsupportedStopRef | null;
  }> = [];

  if (sorted.length === 0) {
    if (totalKm > 0) {
      gaps.push({ startKm: 0, endKm: totalKm, stopBefore: null, stopAfter: null });
    }
    return gaps;
  }

  gaps.push({
    startKm: 0,
    endKm: sorted[0].distance_along_km,
    stopBefore: null,
    stopAfter: stopRef(sorted[0]),
  });

  for (let index = 0; index < sorted.length - 1; index += 1) {
    gaps.push({
      startKm: sorted[index].distance_along_km,
      endKm: sorted[index + 1].distance_along_km,
      stopBefore: stopRef(sorted[index]),
      stopAfter: stopRef(sorted[index + 1]),
    });
  }

  const last = sorted[sorted.length - 1];
  gaps.push({
    startKm: last.distance_along_km,
    endKm: totalKm,
    stopBefore: stopRef(last),
    stopAfter: null,
  });

  return gaps;
}

function reliableGapWithoutCategory(
  zones: ResupplyZone[],
  totalKm: number,
  check: (zone: ResupplyZone) => boolean,
): Array<{ startKm: number; endKm: number }> {
  const reliable = zones.filter(check).sort((left, right) => left.distance_along_km - right.distance_along_km);
  const gaps: Array<{ startKm: number; endKm: number }> = [];

  if (reliable.length === 0) {
    if (totalKm > 0) {
      gaps.push({ startKm: 0, endKm: totalKm });
    }
    return gaps;
  }

  gaps.push({ startKm: 0, endKm: reliable[0].distance_along_km });
  for (let index = 0; index < reliable.length - 1; index += 1) {
    gaps.push({
      startKm: reliable[index].distance_along_km,
      endKm: reliable[index + 1].distance_along_km,
    });
  }
  gaps.push({
    startKm: reliable[reliable.length - 1].distance_along_km,
    endKm: totalKm,
  });

  return gaps;
}

function gapContainsRange(
  gapStartKm: number,
  gapEndKm: number,
  rangeStartKm: number,
  rangeEndKm: number,
): boolean {
  return gapStartKm <= rangeStartKm + 0.5 && gapEndKm >= rangeEndKm - 0.5;
}

function categoryGapFlags(
  startKm: number,
  endKm: number,
  waterGaps: Array<{ startKm: number; endKm: number }>,
  foodGaps: Array<{ startKm: number; endKm: number }>,
): { noReliableWaterGap: boolean; noReliableFoodGap: boolean } {
  const noReliableWaterGap = waterGaps.some(
    (gap) =>
      gapContainsRange(gap.startKm, gap.endKm, startKm, endKm) &&
      gap.endKm - gap.startKm >= MIN_DISTANCE_KM,
  );
  const noReliableFoodGap = foodGaps.some(
    (gap) =>
      gapContainsRange(gap.startKm, gap.endKm, startKm, endKm) &&
      gap.endKm - gap.startKm >= MIN_DISTANCE_KM,
  );

  return { noReliableWaterGap, noReliableFoodGap };
}

function sectionId(startKm: number, endKm: number): string {
  return `unsupported-${Math.round(startKm)}-${Math.round(endKm)}`;
}

function riskTierForScore(score: number): UnsupportedRiskTier {
  return (
    RISK_TIERS.find((entry) => score >= entry.minScore)?.tier ??
    RISK_TIERS[RISK_TIERS.length - 1].tier
  );
}

function computeRiskScore(section: {
  distanceKm: number;
  elevationGainM: number;
  gravelPct: number;
  waterAvailability: AvailabilityLevel;
  foodAvailability: AvailabilityLevel;
  isRemote: boolean;
}): number {
  const waterPenalty =
    section.waterAvailability === "none" ? 18 : section.waterAvailability === "limited" ? 9 : 0;
  const foodPenalty =
    section.foodAvailability === "none" ? 18 : section.foodAvailability === "limited" ? 9 : 0;

  return Math.round(
    Math.min(35, section.distanceKm * 0.75) +
      Math.min(22, section.elevationGainM * 0.018) +
      waterPenalty +
      foodPenalty +
      Math.min(12, section.gravelPct * 0.25) +
      (section.isRemote ? 10 : 0),
  );
}

function buildWhyBadges(section: {
  distanceKm: number;
  elevationGainM: number;
  gravelPct: number;
  waterAvailability: AvailabilityLevel;
  foodAvailability: AvailabilityLevel;
  isRemote: boolean;
  reliableWaterBefore: UnsupportedStopRef | null;
  reliableWaterAfter: UnsupportedStopRef | null;
  reliableFoodBefore: UnsupportedStopRef | null;
  reliableFoodAfter: UnsupportedStopRef | null;
}): UnsupportedWhyBadge[] {
  const badges: UnsupportedWhyBadge[] = [];

  if (section.waterAvailability === "none" && section.distanceKm >= MIN_DISTANCE_KM) {
    badges.push({
      id: "no-water",
      emoji: "💧",
      label: `No reliable water for ${Math.round(section.distanceKm)} km`,
      shortLabel: `No water · ${Math.round(section.distanceKm)} km`,
    });
  } else if (section.waterAvailability === "limited") {
    badges.push({
      id: "limited-water",
      emoji: "💧",
      label: "Only limited water options inside section",
      shortLabel: "Limited water",
    });
  }

  if (section.foodAvailability === "none" && section.distanceKm >= MIN_DISTANCE_KM) {
    badges.push({
      id: "no-food",
      emoji: "🍔",
      label: `No reliable food for ${Math.round(section.distanceKm)} km`,
      shortLabel: `No food · ${Math.round(section.distanceKm)} km`,
    });
  } else if (section.foodAvailability === "limited") {
    badges.push({
      id: "limited-food",
      emoji: "🍔",
      label: "Only limited food options inside section",
      shortLabel: "Limited food",
    });
  }

  if (section.elevationGainM >= MIN_GAIN_M) {
    badges.push({
      id: "high-gain",
      emoji: "⛰️",
      label: `+${section.elevationGainM.toLocaleString()} m climbing`,
      shortLabel: `+${section.elevationGainM.toLocaleString()} m`,
    });
  }

  if (section.gravelPct >= SIGNIFICANT_GRAVEL_PCT) {
    badges.push({
      id: "gravel",
      emoji: "🪨",
      label: `${section.gravelPct}% gravel surface`,
      shortLabel: `${section.gravelPct}% gravel`,
    });
  }

  if (section.isRemote) {
    badges.push({
      id: "remote",
      emoji: "📍",
      label: "Remote · few backup options",
      shortLabel: "Remote section",
    });
  }

  return badges.slice(0, 4);
}

function isMeaningfulSection(section: {
  distanceKm: number;
  elevationGainM: number;
  gravelPct: number;
  waterAvailability: AvailabilityLevel;
  foodAvailability: AvailabilityLevel;
  isRemote: boolean;
  noReliableWaterGap: boolean;
  noReliableFoodGap: boolean;
}): boolean {
  return (
    section.distanceKm >= MIN_DISTANCE_KM ||
    section.elevationGainM >= MIN_GAIN_M ||
    (section.gravelPct >= SIGNIFICANT_GRAVEL_PCT &&
      section.distanceKm >= MIN_GRAVEL_DISTANCE_KM) ||
    (section.noReliableWaterGap && section.distanceKm >= MIN_DISTANCE_KM) ||
    (section.noReliableFoodGap && section.distanceKm >= MIN_DISTANCE_KM) ||
    section.isRemote
  );
}

function analyzeSection(
  startKm: number,
  endKm: number,
  zones: ResupplyZone[],
  route: RouteVisualization,
  gapMeta: { stopBefore: UnsupportedStopRef | null; stopAfter: UnsupportedStopRef | null },
  flags: { noReliableWaterGap: boolean; noReliableFoodGap: boolean },
): UnsupportedSection | null {
  const distanceKm = endKm - startKm;
  if (distanceKm <= 0) {
    return null;
  }

  const trackPoints = route.track_points;
  const elevationGainM = elevationGainInKmRange(trackPoints, startKm, endKm);
  const elevationLossM = elevationLossInKmRange(trackPoints, startKm, endKm);
  const gravelPct = gravelPctInKmRange(route, startKm, endKm);
  const waterAvailability =
    flags.noReliableWaterGap && distanceKm >= MIN_DISTANCE_KM
      ? "none"
      : availabilityInRange(zones, startKm, endKm, zoneHasReliableWater, zoneHasAnyWater);
  const foodAvailability =
    flags.noReliableFoodGap && distanceKm >= MIN_DISTANCE_KM
      ? "none"
      : availabilityInRange(zones, startKm, endKm, zoneHasReliableFood, zoneHasAnyFood);

  const zonesInside = zones.filter(
    (zone) => zone.distance_along_km > startKm && zone.distance_along_km < endKm,
  );
  const alternativeCount = zonesInside.reduce((sum, zone) => {
    return (
      sum +
      zone.categories.reduce((categorySum, group) => categorySum + group.alternatives.length, 0)
    );
  }, 0);
  const isRemote = zonesInside.length === 0 && alternativeCount === 0 && distanceKm >= MIN_DISTANCE_KM;

  if (
    !isMeaningfulSection({
      distanceKm,
      elevationGainM,
      gravelPct,
      waterAvailability,
      foodAvailability,
      isRemote,
      noReliableWaterGap: flags.noReliableWaterGap,
      noReliableFoodGap: flags.noReliableFoodGap,
    })
  ) {
    return null;
  }

  const avgGradientPct =
    elevationGainM >= 80 && distanceKm >= 2
      ? Math.round((elevationGainM / (distanceKm * 1000)) * 1000) / 10
      : null;

  const reliableFoodBefore = findReliableStopBefore(zones, startKm, zoneHasReliableFood);
  const reliableFoodAfter = findReliableStopAfter(zones, endKm, zoneHasReliableFood);
  const reliableWaterBefore = findReliableStopBefore(zones, startKm, zoneHasReliableWater);
  const reliableWaterAfter = findReliableStopAfter(zones, endKm, zoneHasReliableWater);

  const riskScore = computeRiskScore({
    distanceKm,
    elevationGainM,
    gravelPct,
    waterAvailability,
    foodAvailability,
    isRemote,
  });

  const whyBadges = buildWhyBadges({
    distanceKm,
    elevationGainM,
    gravelPct,
    waterAvailability,
    foodAvailability,
    isRemote,
    reliableWaterBefore,
    reliableWaterAfter,
    reliableFoodBefore,
    reliableFoodAfter,
  });

  return {
    id: sectionId(startKm, endKm),
    startKm,
    endKm,
    distanceKm,
    elevationGainM,
    elevationLossM,
    gravelPct,
    avgGradientPct,
    waterAvailability,
    foodAvailability,
    stopBefore: gapMeta.stopBefore,
    stopAfter: gapMeta.stopAfter,
    reliableFoodBefore,
    reliableFoodAfter,
    reliableWaterBefore,
    reliableWaterAfter,
    riskLevel: riskTierForScore(riskScore).level,
    riskScore,
    riskRank: null,
    whyBadges,
    displayLabel: `km ${Math.round(startKm)} → ${Math.round(endKm)}`,
    isRemote,
  };
}

export function riskTierForSection(section: UnsupportedSection): UnsupportedRiskTier {
  return riskTierForScore(section.riskScore);
}

export function unsupportedRiskMedal(rank: number | null): { emoji: string; label: string; ringClass: string } | null {
  if (rank === 1) {
    return { emoji: "🥇", label: "Highest risk", ringClass: "ring-2 ring-amber-300/70" };
  }
  if (rank === 2) {
    return { emoji: "🥈", label: "Second highest risk", ringClass: "ring-2 ring-slate-300/70" };
  }
  if (rank === 3) {
    return { emoji: "🥉", label: "Third highest risk", ringClass: "ring-2 ring-orange-300/60" };
  }
  return null;
}

export function availabilityLabel(level: AvailabilityLevel): string {
  if (level === "available") {
    return "Available";
  }
  if (level === "limited") {
    return "Limited";
  }
  return "None";
}

export function analyzeUnsupportedSections(
  zones: ResupplyZone[],
  route: RouteVisualization,
  totalKm: number,
): UnsupportedSection[] {
  const zoneGaps = buildZoneGaps(zones, totalKm);
  const waterGaps = reliableGapWithoutCategory(zones, totalKm, zoneHasReliableWater);
  const foodGaps = reliableGapWithoutCategory(zones, totalKm, zoneHasReliableFood);

  // Each gap between consecutive resupply zones is already a discrete section.
  // Adjacent gaps share endpoints (km 50→100, 100→150) and must NOT be merged —
  // merging them collapses the full route into a single unsupported section.
  const sections: UnsupportedSection[] = [];

  for (const gap of zoneGaps) {
    const flags = categoryGapFlags(gap.startKm, gap.endKm, waterGaps, foodGaps);
    const section = analyzeSection(
      gap.startKm,
      gap.endKm,
      zones,
      route,
      { stopBefore: gap.stopBefore, stopAfter: gap.stopAfter },
      flags,
    );
    if (section) {
      sections.push(section);
    }
  }

  const ranked = [...sections]
    .sort((left, right) => right.riskScore - left.riskScore || right.distanceKm - left.distanceKm)
    .map((section, index) => ({
      ...section,
      riskRank: index + 1,
    }));

  return ranked;
}
