import type { ClimbRow, PoiRow, ResupplyZone, TrackPoint } from "../api";

const WATER_RELIABLE_SCORE = 10;
const FOOD_RELIABLE_SCORE = 35;
const ON_CLIMB_BUFFER_KM = 0.4;
const NEAR_CLIMB_KM = 3;
const SEARCH_AHEAD_KM = 120;

export interface SteepSection {
  startKm: number;
  endKm: number;
  gradientPct: number;
  label: string;
}

export interface ClimbRoadbook {
  steepSections: SteepSection[];
  onClimbWater: PoiRow[];
  onClimbFuel: PoiRow[];
  onClimbFood: PoiRow[];
  nearClimbWater: PoiRow[];
  nearClimbFuel: PoiRow[];
  nearClimbFood: PoiRow[];
  prevReliableWaterKm: number | null;
  nextReliableWaterKm: number | null;
  nextReliableFoodKm: number | null;
  estimatedClimbingHours: number;
  refillAdvice: string;
}

function isWaterPoi(poi: PoiRow): boolean {
  return poi.category === "Drinking water";
}

function isFoodPoi(poi: PoiRow): boolean {
  return ["Mini supermarket", "Small supermarket", "Supermarket", "Bakery", "Convenience store"].includes(
    poi.category,
  );
}

function isFuelPoi(poi: PoiRow): boolean {
  return poi.category === "Gas station";
}

function isReliableWater(poi: PoiRow): boolean {
  return isWaterPoi(poi) && poi.score >= WATER_RELIABLE_SCORE;
}

function isReliableFood(poi: PoiRow): boolean {
  return isFoodPoi(poi) && poi.score >= FOOD_RELIABLE_SCORE;
}

function poisOnClimb(pois: PoiRow[], climb: ClimbRow): PoiRow[] {
  return pois.filter(
    (poi) =>
      poi.distance_along_km >= climb.start_km - ON_CLIMB_BUFFER_KM &&
      poi.distance_along_km <= climb.end_km + ON_CLIMB_BUFFER_KM,
  );
}

function poisNearClimb(pois: PoiRow[], climb: ClimbRow): PoiRow[] {
  return pois.filter(
    (poi) =>
      poi.distance_along_km >= climb.start_km - NEAR_CLIMB_KM &&
      poi.distance_along_km <= climb.end_km + NEAR_CLIMB_KM,
  );
}

function nextReliableGap(
  pois: PoiRow[],
  fromKm: number,
  predicate: (poi: PoiRow) => boolean,
): number | null {
  const ahead = pois
    .filter((poi) => poi.distance_along_km > fromKm && predicate(poi))
    .sort((left, right) => left.distance_along_km - right.distance_along_km);

  const next = ahead.find((poi) => poi.distance_along_km - fromKm <= SEARCH_AHEAD_KM);
  return next ? next.distance_along_km - fromKm : null;
}

function prevReliableGap(
  pois: PoiRow[],
  beforeKm: number,
  predicate: (poi: PoiRow) => boolean,
): number | null {
  const behind = pois
    .filter((poi) => poi.distance_along_km < beforeKm && predicate(poi))
    .sort((left, right) => right.distance_along_km - left.distance_along_km);

  const previous = behind.find((poi) => beforeKm - poi.distance_along_km <= SEARCH_AHEAD_KM);
  return previous ? beforeKm - previous.distance_along_km : null;
}

/** Rough ultra-cycling estimate: slower on steeper gradients. */
export function estimateClimbingHours(climb: ClimbRow): number {
  const speedKmh = Math.max(6, Math.min(13, 12 - climb.avg_gradient_pct * 0.45));
  return climb.length_km / speedKmh;
}

export function formatClimbingTime(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours} h`;
  }
  return `${wholeHours} h ${minutes} min`;
}

export function detectSteepSections(
  climb: ClimbRow,
  trackPoints: TrackPoint[],
  windowM = 250,
): SteepSection[] {
  const climbPoints = trackPoints.filter(
    (point) => point.km >= climb.start_km && point.km <= climb.end_km && point.ele_m !== null,
  );
  if (climbPoints.length < 3) {
    return [];
  }

  const sections: SteepSection[] = [];
  const threshold = Math.max(climb.avg_gradient_pct * 1.35, 8);

  for (let index = 1; index < climbPoints.length; index += 1) {
    const start = climbPoints[Math.max(0, index - 1)];
    let endIndex = index;
    while (
      endIndex + 1 < climbPoints.length &&
      climbPoints[endIndex + 1].km - start.km <= windowM / 1000
    ) {
      endIndex += 1;
    }
    const end = climbPoints[endIndex];
    const distanceM = Math.max((end.km - start.km) * 1000, 1);
    const gain = (end.ele_m as number) - (start.ele_m as number);
    const gradient = (gain / distanceM) * 100;
    if (gradient >= threshold) {
      sections.push({
        startKm: start.km,
        endKm: end.km,
        gradientPct: gradient,
        label: `${gradient.toFixed(1)}% · ${Math.round(distanceM)} m`,
      });
    }
  }

  return sections
    .sort((left, right) => right.gradientPct - left.gradientPct)
    .slice(0, 3);
}

export function buildClimbRoadbook(
  climb: ClimbRow,
  pois: PoiRow[],
  _zones: ResupplyZone[],
  trackPoints: TrackPoint[],
): ClimbRoadbook {
  const onClimb = poisOnClimb(pois, climb);
  const nearClimb = poisNearClimb(pois, climb);

  const nextReliableWaterKm = nextReliableGap(pois, climb.end_km, isReliableWater);
  const nextReliableFoodKm = nextReliableGap(pois, climb.end_km, isReliableFood);
  const prevReliableWaterKm = prevReliableGap(pois, climb.start_km, isReliableWater);
  const estimatedClimbingHours = estimateClimbingHours(climb);

  let refillAdvice = "Water and food look manageable after this climb.";
  if (nextReliableWaterKm !== null && nextReliableWaterKm > 25) {
    refillAdvice = `Refill water before the summit — next reliable water is ${Math.round(nextReliableWaterKm)} km ahead.`;
  } else if (nextReliableFoodKm !== null && nextReliableFoodKm > 40) {
    refillAdvice = `Consider food before this climb — next reliable food is ${Math.round(nextReliableFoodKm)} km after the summit.`;
  } else if (onClimb.filter(isReliableWater).length === 0 && nearClimb.filter(isReliableWater).length === 0) {
    refillAdvice = "No reliable water on or immediately around this climb — plan ahead.";
  }

  return {
    steepSections: detectSteepSections(climb, trackPoints),
    onClimbWater: onClimb.filter(isWaterPoi),
    onClimbFuel: onClimb.filter(isFuelPoi),
    onClimbFood: onClimb.filter(isFoodPoi),
    nearClimbWater: nearClimb.filter(isWaterPoi),
    nearClimbFuel: nearClimb.filter(isFuelPoi),
    nearClimbFood: nearClimb.filter(isFoodPoi),
    prevReliableWaterKm,
    nextReliableWaterKm,
    nextReliableFoodKm,
    estimatedClimbingHours,
    refillAdvice,
  };
}

export function climbProfilePoints(
  climb: ClimbRow,
  trackPoints: TrackPoint[],
): Array<{ km: number; ele: number }> {
  return trackPoints
    .filter(
      (point) =>
        point.km >= climb.start_km && point.km <= climb.end_km && point.ele_m !== null,
    )
    .map((point) => ({ km: point.km, ele: point.ele_m as number }));
}
