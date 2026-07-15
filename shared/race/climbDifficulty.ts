/** Shared climb difficulty scoring for Desktop and Companion. */

export interface ClimbMetrics {
  lengthKm: number;
  elevationGainM: number;
  avgGradientPct: number;
  max50mPct?: number | null;
  max100mPct?: number | null;
  max250mPct?: number | null;
  max500mPct?: number | null;
  max1000mPct?: number | null;
}

export interface ClimbDifficultyTier {
  score: number;
  label: string;
  /** Yellow → Orange → Red → Dark Red */
  color: string;
  haloColor: string;
}

const SCORE_WEIGHTS = {
  elevationGainM: 0.22,
  lengthKm: 0.18,
  avgGradientPct: 0.15,
  max50mPct: 0.1,
  max100mPct: 0.08,
  max250mPct: 0.08,
  max500mPct: 0.09,
  max1000mPct: 0.1,
} as const;

const ABSOLUTE_REFERENCES = {
  elevationGainM: 1200,
  lengthKm: 35,
  avgGradientPct: 10,
  max50mPct: 22,
  max100mPct: 18,
  max250mPct: 15,
  max500mPct: 12,
  max1000mPct: 11,
} as const;

function metricValue(climb: ClimbMetrics, key: keyof typeof SCORE_WEIGHTS): number {
  if (key === "elevationGainM") return climb.elevationGainM;
  if (key === "lengthKm") return climb.lengthKm;
  if (key === "avgGradientPct") return climb.avgGradientPct;
  if (key === "max50mPct") return climb.max50mPct ?? 0;
  if (key === "max100mPct") return climb.max100mPct ?? 0;
  if (key === "max250mPct") return climb.max250mPct ?? 0;
  if (key === "max500mPct") return climb.max500mPct ?? 0;
  return climb.max1000mPct ?? 0;
}

function absoluteComponent(value: number, reference: number): number {
  if (value <= 0 || reference <= 0) {
    return 0;
  }
  return Math.min(1, value / reference);
}

export function computeClimbDifficultyScore(climb: ClimbMetrics): number {
  let weighted = 0;
  (Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>).forEach((key) => {
    weighted += absoluteComponent(metricValue(climb, key), ABSOLUTE_REFERENCES[key]) * SCORE_WEIGHTS[key];
  });
  return Math.min(100, Math.round(weighted * 100));
}

export function climbDifficultyTier(score: number): ClimbDifficultyTier {
  if (score >= 85) {
    return { score, label: "Monster", color: "#7f1d1d", haloColor: "#991b1b" };
  }
  if (score >= 70) {
    return { score, label: "Very Hard", color: "#ef4444", haloColor: "#dc2626" };
  }
  if (score >= 55) {
    return { score, label: "Hard", color: "#f97316", haloColor: "#ea580c" };
  }
  if (score >= 35) {
    return { score, label: "Moderate", color: "#facc15", haloColor: "#eab308" };
  }
  return { score, label: "Easy", color: "#fde047", haloColor: "#facc15" };
}

export function analyzeClimbDifficulty(climb: ClimbMetrics): ClimbDifficultyTier {
  return climbDifficultyTier(computeClimbDifficultyScore(climb));
}

export function maxGradientPct(climb: ClimbMetrics): number | null {
  const values = [
    climb.max50mPct,
    climb.max100mPct,
    climb.max250mPct,
    climb.max500mPct,
    climb.max1000mPct,
  ].filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

export function steepestSectionLabel(climb: ClimbMetrics): string | null {
  const entries: Array<{ label: string; value: number | null | undefined }> = [
    { label: "1 km", value: climb.max1000mPct },
    { label: "500 m", value: climb.max500mPct },
    { label: "250 m", value: climb.max250mPct },
    { label: "100 m", value: climb.max100mPct },
    { label: "50 m", value: climb.max50mPct },
  ];
  const best = entries
    .filter((entry) => entry.value != null && Number.isFinite(entry.value))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))[0];
  if (!best?.value) {
    return null;
  }
  return `${best.label} @ ${best.value.toFixed(1)}%`;
}
