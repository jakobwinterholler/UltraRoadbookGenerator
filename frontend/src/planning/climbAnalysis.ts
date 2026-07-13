import type { ClimbRow } from "../api";
import { climbDisplayName } from "./climbLabels";

export type ClimbBadgeId =
  | "longest"
  | "highest_gain"
  | "highest_avg_gradient"
  | "hardest_50m"
  | "hardest_100m"
  | "hardest_250m"
  | "hardest_500m"
  | "hardest_1km"
  | "ultra";

export interface ClimbBadge {
  id: ClimbBadgeId;
  emoji: string;
  label: string;
  shortLabel: string;
}

export const CLIMB_BADGE_DEFINITIONS: Record<ClimbBadgeId, Omit<ClimbBadge, "id">> = {
  longest: { emoji: "🏆", label: "Longest climb", shortLabel: "Longest climb" },
  highest_gain: { emoji: "🏆", label: "Highest elevation gain", shortLabel: "Highest gain" },
  highest_avg_gradient: { emoji: "🏆", label: "Highest average gradient", shortLabel: "Steepest average" },
  hardest_50m: { emoji: "🏆", label: "Hardest 50 m", shortLabel: "Hardest 50 m" },
  hardest_100m: { emoji: "🏆", label: "Hardest 100 m", shortLabel: "Hardest 100 m" },
  hardest_250m: { emoji: "🏆", label: "Hardest 250 m", shortLabel: "Hardest 250 m" },
  hardest_500m: { emoji: "🏆", label: "Hardest 500 m", shortLabel: "Hardest 500 m" },
  hardest_1km: { emoji: "🏆", label: "Hardest 1 km", shortLabel: "Hardest 1 km" },
  ultra: { emoji: "🏆", label: "Ultra climb", shortLabel: "Ultra climb" },
};

/** Badges that best explain why a climb matters on the overview cards. */
const WHY_BADGE_PRIORITY: ClimbBadgeId[] = [
  "longest",
  "highest_gain",
  "hardest_1km",
  "ultra",
  "highest_avg_gradient",
  "hardest_500m",
  "hardest_250m",
  "hardest_100m",
  "hardest_50m",
];

export interface DifficultyTier {
  stars: 1 | 2 | 3 | 4 | 5;
  label: string;
  starClass: string;
  badgeClass: string;
  accentClass: string;
  rowClass: string;
}

export interface AnalyzedClimb extends ClimbRow {
  routeIndex: number;
  displayName: string;
  difficultyScore: number;
  difficultyRank: number | null;
  tier: DifficultyTier;
  badges: ClimbBadge[];
  whyBadges: ClimbBadge[];
  isKeyClimb: boolean;
}

export type ClimbSortMode =
  | "route_order"
  | "difficulty"
  | "length"
  | "elevation_gain"
  | "avg_gradient"
  | "hardest_1km";

const SCORE_WEIGHTS = {
  elevation_gain_m: 0.22,
  length_km: 0.18,
  avg_gradient_pct: 0.15,
  max_50_m_pct: 0.1,
  max_100_m_pct: 0.08,
  max_250_m_pct: 0.08,
  max_500_m_pct: 0.09,
  max_1000_m_pct: 0.1,
} as const;

/**
 * Fixed reference values for absolute difficulty scoring.
 * Same climb metrics should yield a similar score on any route.
 */
const ABSOLUTE_REFERENCES = {
  elevation_gain_m: 1200,
  length_km: 35,
  avg_gradient_pct: 10,
  max_50_m_pct: 22,
  max_100_m_pct: 18,
  max_250_m_pct: 15,
  max_500_m_pct: 12,
  max_1000_m_pct: 11,
} as const;

function metricValue(climb: ClimbRow, key: keyof typeof SCORE_WEIGHTS): number {
  if (key === "elevation_gain_m") return climb.elevation_gain_m;
  if (key === "length_km") return climb.length_km;
  if (key === "avg_gradient_pct") return climb.avg_gradient_pct;
  if (key === "max_50_m_pct") return climb.max_50_m_pct ?? 0;
  if (key === "max_100_m_pct") return climb.max_100_m_pct ?? 0;
  if (key === "max_250_m_pct") return climb.max_250_m_pct ?? 0;
  if (key === "max_500_m_pct") return climb.max_500_m_pct ?? 0;
  return climb.max_1000_m_pct ?? 0;
}

function absoluteComponent(value: number, reference: number): number {
  if (value <= 0 || reference <= 0) {
    return 0;
  }
  return Math.min(1, value / reference);
}

export function computeAbsoluteDifficultyScore(climb: ClimbRow): number {
  let weighted = 0;
  (Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>).forEach((key) => {
    const value = metricValue(climb, key);
    const reference = ABSOLUTE_REFERENCES[key];
    weighted += absoluteComponent(value, reference) * SCORE_WEIGHTS[key];
  });
  return Math.min(100, Math.round(weighted * 100));
}

export function difficultyTier(score: number): DifficultyTier {
  if (score >= 85) {
    return {
      stars: 5,
      label: "Monster",
      starClass: "text-purple-600",
      badgeClass: "bg-purple-100 text-purple-900 ring-purple-200",
      accentClass: "border-purple-400 bg-purple-50/60",
      rowClass: "border-l-4 border-l-purple-500 bg-purple-50/35",
    };
  }
  if (score >= 70) {
    return {
      stars: 4,
      label: "Very Hard",
      starClass: "text-red-600",
      badgeClass: "bg-red-100 text-red-900 ring-red-200",
      accentClass: "border-red-300 bg-red-50/50",
      rowClass: "border-l-4 border-l-red-500 bg-red-50/30",
    };
  }
  if (score >= 55) {
    return {
      stars: 3,
      label: "Hard",
      starClass: "text-orange-600",
      badgeClass: "bg-orange-100 text-orange-900 ring-orange-200",
      accentClass: "border-orange-300 bg-orange-50/40",
      rowClass: "border-l-4 border-l-orange-500 bg-orange-50/20",
    };
  }
  if (score >= 35) {
    return {
      stars: 2,
      label: "Moderate",
      starClass: "text-amber-500",
      badgeClass: "bg-amber-100 text-amber-900 ring-amber-200",
      accentClass: "border-amber-300 bg-amber-50/30",
      rowClass: "border-l-2 border-l-amber-400",
    };
  }
  return {
    stars: 1,
    label: "Easy",
    starClass: "text-emerald-600",
    badgeClass: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    accentClass: "border-emerald-200 bg-emerald-50/30",
    rowClass: "",
  };
}

function isUltraClimb(climb: ClimbRow): boolean {
  return (
    climb.length_km >= 15
    || climb.elevation_gain_m >= 600
    || (climb.length_km >= 8 && climb.avg_gradient_pct >= 5)
  );
}

function awardRecordBadges(
  climbs: ClimbRow[],
  metric: (climb: ClimbRow) => number,
  badgeId: ClimbBadgeId,
  badgeMap: Map<string, ClimbBadge[]>,
): void {
  const values = climbs.map(metric);
  const max = Math.max(...values);
  if (max <= 0) {
    return;
  }

  climbs.forEach((climb) => {
    if (metric(climb) !== max) {
      return;
    }
    const existing = badgeMap.get(climb.id) ?? [];
    existing.push({ id: badgeId, ...CLIMB_BADGE_DEFINITIONS[badgeId] });
    badgeMap.set(climb.id, existing);
  });
}

function computeBadges(climbs: ClimbRow[]): Map<string, ClimbBadge[]> {
  const badgeMap = new Map<string, ClimbBadge[]>();

  awardRecordBadges(climbs, (climb) => climb.length_km, "longest", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.elevation_gain_m, "highest_gain", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.avg_gradient_pct, "highest_avg_gradient", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.max_50_m_pct ?? 0, "hardest_50m", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.max_100_m_pct ?? 0, "hardest_100m", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.max_250_m_pct ?? 0, "hardest_250m", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.max_500_m_pct ?? 0, "hardest_500m", badgeMap);
  awardRecordBadges(climbs, (climb) => climb.max_1000_m_pct ?? 0, "hardest_1km", badgeMap);

  climbs.forEach((climb) => {
    if (!isUltraClimb(climb)) {
      return;
    }
    const existing = badgeMap.get(climb.id) ?? [];
    existing.push({ id: "ultra", ...CLIMB_BADGE_DEFINITIONS.ultra });
    badgeMap.set(climb.id, existing);
  });

  return badgeMap;
}

function selectWhyBadges(badges: ClimbBadge[], limit = 4): ClimbBadge[] {
  const byId = new Map(badges.map((badge) => [badge.id, badge]));
  const ordered: ClimbBadge[] = [];

  for (const id of WHY_BADGE_PRIORITY) {
    const badge = byId.get(id);
    if (badge) {
      ordered.push(badge);
    }
    if (ordered.length >= limit) {
      break;
    }
  }

  return ordered;
}

export function keyClimbCount(total: number): number {
  if (total <= 2) {
    return total;
  }
  if (total <= 4) {
    return 3;
  }
  return 5;
}

export function analyzeClimbs(climbs: ClimbRow[]): AnalyzedClimb[] {
  const sortedByRoute = [...climbs].sort((left, right) => left.start_km - right.start_km);
  const routeIndexById = new Map(sortedByRoute.map((climb, index) => [climb.id, index]));
  const badges = computeBadges(climbs);

  const analyzed = climbs.map((climb) => {
    const routeIndex = routeIndexById.get(climb.id) ?? 0;
    const climbBadges = badges.get(climb.id) ?? [];
    const difficultyScore = computeAbsoluteDifficultyScore(climb);
    return {
      ...climb,
      routeIndex,
      displayName: climbDisplayName(climb, routeIndex),
      difficultyScore,
      difficultyRank: null,
      tier: difficultyTier(difficultyScore),
      badges: climbBadges,
      whyBadges: selectWhyBadges(climbBadges),
      isKeyClimb: false,
    };
  });

  const keyCount = keyClimbCount(analyzed.length);
  const ranked = [...analyzed].sort((left, right) => right.difficultyScore - left.difficultyScore);
  const keyIds = new Set(ranked.slice(0, keyCount).map((climb) => climb.id));
  const rankById = new Map(ranked.map((climb, index) => [climb.id, index + 1]));

  return analyzed.map((climb) => ({
    ...climb,
    isKeyClimb: keyIds.has(climb.id),
    difficultyRank: rankById.get(climb.id) ?? null,
  }));
}

export function selectKeyClimbs(analyzed: AnalyzedClimb[]): AnalyzedClimb[] {
  return [...analyzed]
    .filter((climb) => climb.isKeyClimb)
    .sort((left, right) => right.difficultyScore - left.difficultyScore);
}

export function sortAnalyzedClimbs(
  analyzed: AnalyzedClimb[],
  mode: ClimbSortMode,
): AnalyzedClimb[] {
  const next = [...analyzed];
  switch (mode) {
    case "difficulty":
      return next.sort((left, right) => right.difficultyScore - left.difficultyScore);
    case "length":
      return next.sort((left, right) => right.length_km - left.length_km);
    case "elevation_gain":
      return next.sort((left, right) => right.elevation_gain_m - left.elevation_gain_m);
    case "avg_gradient":
      return next.sort((left, right) => right.avg_gradient_pct - left.avg_gradient_pct);
    case "hardest_1km":
      return next.sort(
        (left, right) => (right.max_1000_m_pct ?? 0) - (left.max_1000_m_pct ?? 0),
      );
    case "route_order":
    default:
      return next.sort((left, right) => left.start_km - right.start_km);
  }
}

export function filterAnalyzedClimbs(
  analyzed: AnalyzedClimb[],
  query: string,
): AnalyzedClimb[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return analyzed;
  }

  return analyzed.filter((climb) => {
    const haystack = [
      climb.displayName,
      climb.id,
      climb.nickname ?? "",
      climb.tier.label,
      ...climb.badges.map((badge) => badge.label),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function keyClimbMedal(rank: number | null): { emoji: string; label: string; ringClass: string } | null {
  if (rank === 1) {
    return { emoji: "🥇", label: "#1 hardest", ringClass: "ring-2 ring-amber-400" };
  }
  if (rank === 2) {
    return { emoji: "🥈", label: "#2 hardest", ringClass: "ring-2 ring-slate-300" };
  }
  if (rank === 3) {
    return { emoji: "🥉", label: "#3 hardest", ringClass: "ring-2 ring-orange-300" };
  }
  return null;
}
