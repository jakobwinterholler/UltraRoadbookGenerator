import type { SurfaceInsight } from "../api";
import type { SurfaceCategoryStat } from "./surfaceBreakdown";

export type EquipmentRecommendationCategory = "tyres" | "bike" | "pacing" | "general";

export interface EquipmentRecommendation {
  id: string;
  category: EquipmentRecommendationCategory;
  title: string;
  detail: string;
  priority: "essential" | "consider" | "info";
}

function categoryPercent(categories: SurfaceCategoryStat[], name: string): number {
  return categories.find((row) => row.riderCategory === name)?.percentage ?? 0;
}

function categoryKm(categories: SurfaceCategoryStat[], name: string): number {
  return categories.find((row) => row.riderCategory === name)?.distanceKm ?? 0;
}

function longestInsightForCategory(
  insights: SurfaceInsight[],
  category: string,
): SurfaceInsight | null {
  const matches = insights.filter((insight) => insight.category === category);
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((best, insight) =>
    insight.length_km > best.length_km ? insight : best,
  );
}

export function buildSurfaceEquipmentRecommendations(
  categories: SurfaceCategoryStat[],
  insights: SurfaceInsight[],
): EquipmentRecommendation[] {
  const recommendations: EquipmentRecommendation[] = [];

  const roadPct = categoryPercent(categories, "Road");
  const gravelPct = categoryPercent(categories, "Gravel");
  const trailPct = categoryPercent(categories, "Trail");
  const unknownPct = categoryPercent(categories, "Unknown");
  const gravelKm = categoryKm(categories, "Gravel");
  const trailKm = categoryKm(categories, "Trail");
  const longestGravel = longestInsightForCategory(insights, "Gravel");
  const longestTrail = longestInsightForCategory(insights, "Trail");

  if (roadPct >= 90 && gravelPct < 5 && trailPct < 2) {
    recommendations.push({
      id: "road-setup",
      category: "general",
      title: "Standard road setup",
      detail: "Mostly paved road — your usual road bike and tyres should be fine.",
      priority: "info",
    });
  }

  if (gravelPct >= 15 || gravelKm >= 30) {
    recommendations.push({
      id: "gravel-tyres",
      category: "tyres",
      title: "Plan for gravel tyres",
      detail: `${gravelPct.toFixed(0)}% gravel (${gravelKm.toFixed(0)} km) — consider 32–40 mm all-road or gravel tyres for comfort and puncture resistance.`,
      priority: gravelPct >= 25 ? "essential" : "consider",
    });
  } else if (gravelPct >= 5 || gravelKm >= 10) {
    recommendations.push({
      id: "gravel-light",
      category: "tyres",
      title: "Light gravel sections",
      detail: `${gravelKm.toFixed(0)} km of gravel — 28–32 mm tyres with some tread should handle occasional loose sections.`,
      priority: "consider",
    });
  }

  if (trailPct >= 10 || trailKm >= 15) {
    recommendations.push({
      id: "trail-tyres",
      category: "tyres",
      title: "Trail sections need grip",
      detail: `${trailPct.toFixed(0)}% trail (${trailKm.toFixed(0)} km) — use tyres with reliable off-road grip; consider tubeless for rough terrain.`,
      priority: trailPct >= 20 ? "essential" : "consider",
    });
  }

  if (gravelPct + trailPct >= 25) {
    recommendations.push({
      id: "all-road-bike",
      category: "bike",
      title: "All-road or gravel bike",
      detail: "Rough surface makes up a meaningful share of this route — an endurance gravel or all-road bike may be more comfortable than a pure road race setup.",
      priority: gravelPct + trailPct >= 40 ? "essential" : "consider",
    });
  }

  if (longestGravel && longestGravel.length_km >= 12) {
    recommendations.push({
      id: "gravel-pacing",
      category: "pacing",
      title: "Pace the long gravel section",
      detail: `${longestGravel.length_km.toFixed(1)} km of gravel around km ${Math.round(longestGravel.start_km)} — expect slower progress and more fatigue; plan extra time and food for this stretch.`,
      priority: longestGravel.length_km >= 20 ? "essential" : "consider",
    });
  }

  if (longestTrail && longestTrail.length_km >= 8) {
    recommendations.push({
      id: "trail-pacing",
      category: "pacing",
      title: "Allow time on trail",
      detail: `${longestTrail.length_km.toFixed(1)} km of trail around km ${Math.round(longestTrail.start_km)} — technical surface will slow you down; don't plan aggressive targets through here.`,
      priority: "consider",
    });
  }

  if (unknownPct >= 5) {
    recommendations.push({
      id: "unknown-surface",
      category: "general",
      title: "Some surface is uncertain",
      detail: `${unknownPct.toFixed(0)}% of the route has unclear surface data — choose conservative tyre and pacing assumptions until you verify on the map.`,
      priority: unknownPct >= 15 ? "consider" : "info",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "balanced-setup",
      category: "general",
      title: "Balanced setup",
      detail: "No major surface concerns detected — standard ultra-distance equipment should work.",
      priority: "info",
    });
  }

  const priorityRank = { essential: 0, consider: 1, info: 2 };
  return recommendations.sort(
    (left, right) => priorityRank[left.priority] - priorityRank[right.priority],
  );
}
