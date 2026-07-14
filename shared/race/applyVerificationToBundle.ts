import type { CompanionBundle, CompanionStop } from "../types/sync";
import type { CompanionVerificationSubmission } from "../types/verification";

function stopStatusFromSubmission(
  _updates: CompanionVerificationSubmission["updates"],
): CompanionStop["verificationStatus"] {
  return "pending";
}

function patchStop(
  stop: CompanionStop,
  submission: CompanionVerificationSubmission,
): CompanionStop {
  const { updates } = submission;
  const status = stopStatusFromSubmission(updates);
  const services = updates.services;
  return {
    ...stop,
    verificationStatus: status,
    verificationDate: null,
    notes: updates.notes?.trim() || stop.notes,
    openingHours:
      updates.openingHours?.trim() ||
      (updates.services ? stop.openingHours : stop.openingHours),
    hasWater: services?.hasWater ?? stop.hasWater,
    hasFood: services?.hasFood ?? stop.hasFood,
    hasFuel: services?.hasFuel ?? stop.hasFuel,
    hasCoffee: services?.hasCoffee ?? stop.hasCoffee,
  };
}

function recountDashboardStats(bundle: CompanionBundle): CompanionBundle["dashboardStats"] {
  const total = bundle.stops.length;
  const verified = bundle.stops.filter((stop) => stop.verificationStatus === "verified").length;
  const unverified = total - verified;
  const existing = bundle.dashboardStats;
  return {
    verifiedStops: verified,
    unverifiedStops: unverified,
    remainingStops: unverified,
    remainingUnsupportedKm: existing?.remainingUnsupportedKm ?? 0,
    readinessScore: existing
      ? Math.round((verified / Math.max(total, 1)) * existing.readinessScore)
      : Math.round((verified / Math.max(total, 1)) * 100),
    readinessReasons: existing?.readinessReasons ?? [],
  };
}

/** Optimistically patch companion bundle after a verification submission. */
export function applyVerificationToBundle(
  bundle: CompanionBundle,
  submission: CompanionVerificationSubmission,
): CompanionBundle {
  const stops = bundle.stops.map((stop) =>
    stop.zoneId === submission.zoneId ? patchStop(stop, submission) : stop,
  );
  const next: CompanionBundle = {
    ...bundle,
    stops,
    syncedAt: new Date().toISOString(),
    revision: (bundle.revision ?? 0) + 1,
  };
  next.dashboardStats = recountDashboardStats(next);
  return next;
}

/** Revert a verification by restoring the prior stop snapshot. */
export function revertVerificationOnBundle(
  bundle: CompanionBundle,
  zoneId: number,
  priorStop: CompanionStop,
): CompanionBundle {
  const stops = bundle.stops.map((stop) => (stop.zoneId === zoneId ? priorStop : stop));
  const next: CompanionBundle = { ...bundle, stops };
  next.dashboardStats = recountDashboardStats(next);
  return next;
}

export function verificationStatsLine(bundle: CompanionBundle): string {
  const total = bundle.stops.length;
  const verified = bundle.stops.filter((stop) => stop.verificationStatus === "verified").length;
  const remaining = total - verified;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  return `${total} stops · ${verified} verified · ${remaining} remaining · ${pct}%`;
}
