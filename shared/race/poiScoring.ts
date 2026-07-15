/** Shared POI scoring for primary stop selection (mirrors src/poi_scoring.py). */

import { assessFuelShop } from "./fuelShopScoring";

export interface PoiScoringInput {
  priority: number;
  category: string;
  distanceOffRouteM: number;
  score?: number;
  name?: string | null;
  brand?: string | null;
  openingHours?: string | null;
  tags?: Record<string, string> | null;
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
  "Gas station": 28,
  "Convenience store": 22,
  Bakery: 18,
  "Drinking water": 14,
  "Fast food": 10,
  "Café": 8,
  Restaurant: 6,
};

const OFF_ROUTE_PENALTY_PER_M = 0.45;
const NAMED_BONUS = 12;
const BRAND_BONUS = 6;
const UNNAMED_DRINKING_WATER_PENALTY = 10;

/** Mirrors opening_hours_reliability_bonus in src/opening_hours_score.py (simplified). */
export function openingHoursReliabilityBonus(openingHours: string | null | undefined): number {
  if (!openingHours?.trim()) {
    return 0;
  }
  const normalized = openingHours.trim().toLowerCase();
  if (normalized.includes("24/7") || normalized.startsWith("24")) {
    return 28;
  }
  if (/mo|tu|we|th|fr|sa|su|mon|tue|wed|thu|fri|sat|sun/i.test(normalized)) {
    if (/00:00-24:00|00:00-23:59/i.test(normalized)) {
      return 24;
    }
    if (normalized.length >= 24) {
      return 18;
    }
    return 12;
  }
  return 6;
}

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
  score += openingHoursReliabilityBonus(input.openingHours);
  const fuelShop = assessFuelShop({
    category: input.category,
    tags: input.tags,
    name: input.name,
    brand: input.brand,
  });
  if (fuelShop) {
    score += fuelShop.scoreAdjustment;
  }
  if (input.category === "Drinking water" && !input.name?.trim() && !input.brand?.trim()) {
    score -= UNNAMED_DRINKING_WATER_PENALTY;
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
