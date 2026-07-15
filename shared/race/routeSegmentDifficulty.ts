/** Shared route-segment difficulty scoring for Desktop and Companion. */

export interface RouteSegmentMetrics {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  ridingTimeHours?: number;
}

export interface RouteSegmentDifficulty {
  score: number;
  label: string;
  color: string;
}

function segmentDifficultyScore(metrics: RouteSegmentMetrics): number {
  let score = metrics.distanceKm * 3;
  score += metrics.elevationGainM * 0.4;
  score += metrics.elevationLossM * 0.15;
  if (metrics.ridingTimeHours != null && metrics.ridingTimeHours > 0) {
    score += metrics.ridingTimeHours * 18;
  }
  return Math.round(score);
}

function segmentDifficultyTier(score: number): RouteSegmentDifficulty {
  if (score >= 220) {
    return { score, label: "Very Hard", color: "#ef4444" };
  }
  if (score >= 150) {
    return { score, label: "Hard", color: "#f97316" };
  }
  if (score >= 90) {
    return { score, label: "Moderate", color: "#facc15" };
  }
  return { score, label: "Easy", color: "#86efac" };
}

export function analyzeRouteSegmentDifficulty(
  metrics: RouteSegmentMetrics,
): RouteSegmentDifficulty {
  return segmentDifficultyTier(segmentDifficultyScore(metrics));
}
