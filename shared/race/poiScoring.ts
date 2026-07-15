/** Shared POI scoring for primary stop selection (mirrors src/poi_scoring.py). */

export interface PoiScoringInput {
  priority: number;
  category: string;
  distanceOffRouteM: number;
  score?: number;
  name?: string | null;
  brand?: string | null;
  openingHours?: string | null;
}

const PRIORITY_WEIGHT: Record<number, number> = {
  1: 40,
  2: 12,
  3: 0,
};

const CATEGORY_WEIGHT: Record<string, number> = {
  "Small supermarket": 36,
  "Mini supermarket": 32,
  Supermarket: 20,
  "Gas station": 24,
  Bakery: 18,
  "Drinking water": 14,
  "Fast food": 10,
  "Café": 8,
  Restaurant: 6,
};

const OFF_ROUTE_PENALTY_PER_M = 0.45;
const NAMED_BONUS = 12;
const BRAND_BONUS = 6;
const OPENING_HOURS_BONUS = 8;

/** Score one POI for primary selection. Higher is better. */
export function scorePoi(input: PoiScoringInput): number {
  if (input.score != null && Number.isFinite(input.score)) {
    return input.score;
  }
  let score = PRIORITY_WEIGHT[input.priority] ?? 0;
  score += CATEGORY_WEIGHT[input.category] ?? 0;
  if (input.name?.trim()) {
    score += NAMED_BONUS;
  }
  if (input.brand?.trim()) {
    score += BRAND_BONUS;
  }
  if (input.openingHours?.trim()) {
    score += OPENING_HOURS_BONUS;
  }
  score -= input.distanceOffRouteM * OFF_ROUTE_PENALTY_PER_M;
  return Math.round(score * 100) / 100;
}

/** Planning score with extra detour penalty for stop selection UI. */
export function planningScore(input: PoiScoringInput): number {
  const base = scorePoi(input);
  const detourPenalty = Math.min(input.distanceOffRouteM / 8, 35);
  return base - detourPenalty;
}

export function poiTier(score: number): "excellent" | "good" | "other" {
  if (score >= 68) {
    return "excellent";
  }
  if (score >= 52) {
    return "good";
  }
  return "other";
}
