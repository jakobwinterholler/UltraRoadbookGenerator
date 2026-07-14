import type { RaceDashboardStats, ReadinessReason } from "@shared/race/readiness";
import {
  estimateReviewTimeSeconds,
  formatReviewTime,
  isReadyToRide,
  readinessScoreBg,
  readinessScoreColor,
} from "@shared/race/readiness";

interface ReadinessScoreBadgeProps {
  score: number;
  className?: string;
  dark?: boolean;
}

interface ReadinessStatusHeaderProps {
  score: number;
  unverifiedStops: number;
  dark?: boolean;
  className?: string;
}

export function ReadinessStatusHeader({
  score,
  unverifiedStops,
  dark = false,
  className = "",
}: ReadinessStatusHeaderProps) {
  const ready = isReadyToRide(score);
  const reviewSeconds = estimateReviewTimeSeconds(unverifiedStops);
  const headerClass = ready
    ? dark
      ? "text-emerald-300"
      : "text-emerald-700"
    : dark
      ? "text-amber-200"
      : "text-amber-800";

  return (
    <div className={className}>
      <p className={`text-xl font-semibold tracking-tight ${headerClass}`}>
        {ready ? "READY TO RIDE" : "NOT READY"}
      </p>
      {!ready && unverifiedStops > 0 ? (
        <p className={`mt-1 text-sm ${dark ? "text-white/50" : "text-muted"}`}>
          Estimated review time: {formatReviewTime(reviewSeconds)}
          <span className="opacity-70"> ({unverifiedStops} stops × ~30 sec)</span>
        </p>
      ) : null}
    </div>
  );
}

export function ReadinessScoreBadge({ score, className = "", dark = false }: ReadinessScoreBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${readinessScoreBg(score, dark)} ${className}`}
    >
      <span className={dark ? "" : readinessScoreColor(score)}>{score}%</span>
      <span className="font-medium opacity-80">ready</span>
    </span>
  );
}

interface ReadinessReasonsListProps {
  reasons: ReadinessReason[];
  compact?: boolean;
  dark?: boolean;
  className?: string;
}

export function ReadinessReasonsList({
  reasons,
  compact = false,
  dark = false,
  className = "",
}: ReadinessReasonsListProps) {
  if (reasons.length === 0) {
    return null;
  }
  const visible = compact ? reasons.slice(0, 3) : reasons;
  return (
    <ul className={`space-y-1 ${className}`}>
      {visible.map((reason) => (
        <li
          key={reason.text}
          className={`flex items-start gap-2 text-xs ${
            dark
              ? reason.kind === "pass"
                ? "text-emerald-300/90"
                : "text-amber-200/90"
              : reason.kind === "pass"
                ? "text-emerald-700"
                : "text-amber-800"
          }`}
        >
          <span className="shrink-0" aria-hidden>
            {reason.kind === "pass" ? "✔" : "⚠"}
          </span>
          <span>{reason.text}</span>
        </li>
      ))}
    </ul>
  );
}

interface RaceStatsGridProps {
  stats: RaceDashboardStats;
  dark?: boolean;
  className?: string;
}

export function RaceStatsGrid({ stats, dark = false, className = "" }: RaceStatsGridProps) {
  const label = dark ? "text-white/40" : "text-muted";
  const value = dark ? "text-white/85" : "text-ink";

  const items = [
    { label: "Verified", value: stats.verified_stops },
    { label: "Unverified", value: stats.unverified_stops },
    { label: "Supermarkets", value: stats.supermarkets },
    { label: "Water", value: stats.water_stops },
    { label: "Fuel", value: stats.fuel_stops },
    {
      label: "Longest gap",
      value: stats.longest_unsupported_km != null ? `${Math.round(stats.longest_unsupported_km)} km` : "—",
    },
  ];

  return (
    <dl className={`grid grid-cols-3 gap-x-3 gap-y-2 ${className}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className={`text-[10px] font-medium uppercase tracking-[0.12em] ${label}`}>
            {item.label}
          </dt>
          <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${value}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatLastVerification(iso: string | null | undefined): string {
  if (!iso) {
    return "Never";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
