import type { ResupplyZone, ZonePoiOption } from "../api";
import type { TimeMode } from "./types";
import type { TimeWindowId } from "./timeWindows";
import { zoneMinDetourM } from "./zonePresentation";
import { zoneHasCategory } from "../components/routeInsights";
import { getStopAvailability } from "./stopAvailability";

export type ReliabilityTier =
  | "extremely_reliable"
  | "reliable"
  | "usually_reliable"
  | "limited"
  | "emergency";

export interface ReliabilityPresentation {
  tier: ReliabilityTier;
  stars: number;
  label: string;
  shortLabel: string;
}

export type HoursVisualTone = "open" | "limited" | "closed" | "unknown";

export interface HoursVisual {
  tone: HoursVisualTone;
  emoji: string;
  label: string;
}

export interface UltraStopScoreResult {
  score: number;
  tier: "excellent" | "good" | "fair" | "emergency";
  label: string;
  breakdown: Array<{ key: string; label: string; points: number }>;
}

const RELIABILITY_TIERS: Array<{ minScore: number; tier: ReliabilityTier; stars: number; label: string }> = [
  { minScore: 68, tier: "extremely_reliable", stars: 5, label: "Extremely reliable" },
  { minScore: 52, tier: "reliable", stars: 4, label: "Reliable" },
  { minScore: 38, tier: "usually_reliable", stars: 3, label: "Usually reliable" },
  { minScore: 22, tier: "limited", stars: 2, label: "Limited reliability" },
  { minScore: 0, tier: "emergency", stars: 1, label: "Emergency only" },
];

function primaryOptions(zone: ResupplyZone): ZonePoiOption[] {
  return zone.categories
    .map((group) => group.primary)
    .filter((option): option is ZonePoiOption => option !== null);
}

export function zoneReliabilityScore(zone: ResupplyZone): number {
  const primaries = primaryOptions(zone);
  if (primaries.length === 0) {
    return 0;
  }
  return Math.max(...primaries.map((option) => option.score));
}

export function poiReliabilityPresentation(score: number): ReliabilityPresentation {
  const match =
    RELIABILITY_TIERS.find((tier) => score >= tier.minScore) ??
    RELIABILITY_TIERS[RELIABILITY_TIERS.length - 1];
  return {
    tier: match.tier,
    stars: match.stars,
    label: match.label,
    shortLabel: "★".repeat(match.stars),
  };
}

export function zoneReliabilityPresentation(zone: ResupplyZone): ReliabilityPresentation {
  return poiReliabilityPresentation(zoneReliabilityScore(zone));
}

export function formatHoursVisual(
  openingHours: string | null | undefined,
  timeMode: TimeMode = "day",
  nightUsability?: string,
): HoursVisual {
  const raw = openingHours?.trim();
  if (!raw) {
    if (timeMode === "night" && nightUsability === "usually_available") {
      return { tone: "open", emoji: "🟢", label: "Usually 24/7" };
    }
    if (timeMode === "night" && nightUsability === "usually_closed") {
      return { tone: "closed", emoji: "🔴", label: "Closed at night" };
    }
    return { tone: "unknown", emoji: "⚪", label: "Hours unknown" };
  }

  const normalized = raw.toLowerCase();
  if (normalized.includes("24/7") || normalized.includes("24 hours")) {
    return { tone: "open", emoji: "🟢", label: "24/7" };
  }

  const timeMatch = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(raw);
  if (timeMatch) {
    const start = timeMatch[1].replace(/^0/, "");
    const end = timeMatch[2].replace(/^0/, "");
    const startHour = Number(start.split(":")[0]);
    const endHour = Number(end.split(":")[0]);
    const spansNight = endHour <= startHour || endHour >= 22 || startHour <= 6;
    if (timeMode === "night" && spansNight && endHour > 6 && startHour < 22) {
      return { tone: "limited", emoji: "🟡", label: `${start}–${end}` };
    }
    if (endHour - startHour >= 14 || normalized.includes("24")) {
      return { tone: "open", emoji: "🟢", label: `${start}–${end}` };
    }
    return { tone: "limited", emoji: "🟡", label: `${start}–${end}` };
  }

  if (timeMode === "night" && nightUsability === "usually_closed") {
    return { tone: "closed", emoji: "🔴", label: "Closed at night" };
  }

  return { tone: "unknown", emoji: "⚪", label: raw.length > 28 ? `${raw.slice(0, 28)}…` : raw };
}

export function zoneHoursVisual(zone: ResupplyZone, timeMode: TimeMode): HoursVisual {
  const primaries = primaryOptions(zone);
  if (primaries.length === 0) {
    return { tone: "unknown", emoji: "⚪", label: "Hours unknown" };
  }

  const visuals = primaries.map((option) =>
    formatHoursVisual(option.opening_hours, timeMode, option.night_usability),
  );

  if (visuals.some((item) => item.tone === "open")) {
    return visuals.find((item) => item.tone === "open")!;
  }
  if (visuals.some((item) => item.tone === "limited")) {
    return visuals.find((item) => item.tone === "limited")!;
  }
  if (visuals.every((item) => item.tone === "closed")) {
    return { tone: "closed", emoji: "🔴", label: "Closed at night" };
  }
  return visuals[0];
}

export function computeUltraStopScore(
  zone: ResupplyZone,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): UltraStopScoreResult {
  const breakdown: UltraStopScoreResult["breakdown"] = [];
  const reliability = zoneReliabilityScore(zone);
  const reliabilityPoints = Math.round(reliability * 0.45);
  breakdown.push({ key: "reliability", label: "Reliability", points: reliabilityPoints });

  const detourM = zoneMinDetourM(zone);
  const detourPoints =
    detourM <= 20 ? 18 : detourM <= 75 ? 14 : detourM <= 150 ? 8 : detourM <= 300 ? 4 : 0;
  breakdown.push({ key: "access", label: "Route access", points: detourPoints });

  if (zoneHasCategory(zone, "water")) {
    const water = zone.categories.find((group) => group.key === "water")?.primary;
    breakdown.push({ key: "water", label: "Water", points: water ? Math.min(16, Math.round(water.score * 0.2)) : 8 });
  }
  if (zoneHasCategory(zone, "food")) {
    const food = zone.categories.find((group) => group.key === "food")?.primary;
    breakdown.push({ key: "food", label: "Food", points: food ? Math.min(18, Math.round(food.score * 0.22)) : 8 });
  }
  if (zoneHasCategory(zone, "fuel")) {
    breakdown.push({ key: "fuel", label: "Fuel", points: 6 });
  }

  const availability = zoneAvailabilityForScore(zone, timeWindowId, timeMode);
  if (availability === "open") {
    breakdown.push({ key: "hours", label: "Opening hours", points: 12 });
  } else if (availability === "likely") {
    breakdown.push({ key: "hours", label: "Opening hours", points: 7 });
  } else if (availability === "closed") {
    breakdown.push({ key: "hours", label: "Opening hours", points: -8 });
  }

  const score = Math.max(0, Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0)));
  const tier =
    score >= 78 ? "excellent" : score >= 58 ? "good" : score >= 38 ? "fair" : "emergency";
  const label =
    tier === "excellent"
      ? "Excellent stop"
      : tier === "good"
        ? "Solid stop"
        : tier === "fair"
          ? "Usable with caution"
          : "Emergency only";

  return { score, tier, label, breakdown };
}

function zoneAvailabilityForScore(
  zone: ResupplyZone,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): "open" | "likely" | "closed" | "unknown" {
  if (!timeWindowId) {
    return "unknown";
  }
  const stops = zone.categories
    .filter((group) => group.key !== "dining")
    .flatMap((group) => [group.primary, ...group.alternatives])
    .filter((option): option is ZonePoiOption => option !== null);

  const statuses = stops
    .map((stop) => getStopAvailability(stop, timeWindowId, timeMode)?.status)
    .filter(Boolean);

  if (statuses.includes("open")) return "open";
  if (statuses.includes("likely_open")) return "likely";
  if (statuses.length > 0 && statuses.every((status) => status === "closed")) return "closed";
  return "unknown";
}

export function ultraStopTierClass(tier: UltraStopScoreResult["tier"]): string {
  switch (tier) {
    case "excellent":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "good":
      return "bg-sky-50 text-sky-900 ring-sky-200";
    case "fair":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "emergency":
      return "bg-red-50 text-red-900 ring-red-200";
  }
}
