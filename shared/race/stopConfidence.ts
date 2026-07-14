export type StopConfidenceLevel = "low" | "needs_review" | "high";

export interface StopConfidenceInput {
  verificationStatus: "verified" | "unverified" | "needs_review" | "rejected" | "deferred" | "pending";
  verifiedAt?: string | null;
  poiScore?: number | null;
  openingHours?: string | null;
  website?: string | null;
  phone?: string | null;
}

export interface StopConfidenceResult {
  score: number;
  level: StopConfidenceLevel;
  label: string;
}

const MS_PER_DAY = 86_400_000;
const VERIFICATION_FRESH_DAYS = 30;
const VERIFICATION_STALE_DAYS = 90;

function verificationAgeFactor(verifiedAt: string | null | undefined): number {
  if (!verifiedAt) {
    return 0;
  }
  const ageMs = Date.now() - new Date(verifiedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0.5;
  }
  const ageDays = ageMs / MS_PER_DAY;
  if (ageDays <= VERIFICATION_FRESH_DAYS) {
    return 1;
  }
  if (ageDays >= VERIFICATION_STALE_DAYS) {
    return 0.35;
  }
  const span = VERIFICATION_STALE_DAYS - VERIFICATION_FRESH_DAYS;
  const progress = (ageDays - VERIFICATION_FRESH_DAYS) / span;
  return 1 - progress * 0.65;
}

function poiDataScore(input: StopConfidenceInput): number {
  let score = 0;
  const poi = input.poiScore;
  if (poi != null && Number.isFinite(poi)) {
    score += Math.min(35, (poi / 100) * 35);
  }
  if (input.openingHours?.trim()) {
    score += 12;
  }
  if (input.website?.trim()) {
    score += 8;
  }
  if (input.phone?.trim()) {
    score += 5;
  }
  return score;
}

function levelFromScore(score: number, status: StopConfidenceInput["verificationStatus"]): StopConfidenceLevel {
  if (status === "needs_review" || status === "rejected") {
    return "needs_review";
  }
  if (score >= 70) {
    return "high";
  }
  if (score >= 40) {
    return "needs_review";
  }
  return "low";
}

function labelForLevel(level: StopConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence";
    case "needs_review":
      return "Needs review";
    default:
      return "Low confidence";
  }
}

/** Compute stop confidence from verification age, confirmations, and POI data quality. */
export function computeStopConfidence(input: StopConfidenceInput): StopConfidenceResult {
  let score = poiDataScore(input);

  if (input.verificationStatus === "verified") {
    score += 30 * verificationAgeFactor(input.verifiedAt);
  } else if (input.verificationStatus === "needs_review") {
    score += 10;
  } else if (input.verificationStatus === "pending") {
    score += 8;
  } else if (input.verificationStatus === "deferred") {
    score += 5;
  }

  score = Math.round(Math.min(100, Math.max(0, score)));
  const level = levelFromScore(score, input.verificationStatus);

  return {
    score,
    level,
    label: labelForLevel(level),
  };
}

export function stopConfidenceBadgeClass(level: StopConfidenceLevel, dark = false): string {
  if (level === "high") {
    return dark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-50 text-emerald-700";
  }
  if (level === "needs_review") {
    return dark ? "bg-amber-500/20 text-amber-200" : "bg-amber-50 text-amber-800";
  }
  return dark ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-700";
}
