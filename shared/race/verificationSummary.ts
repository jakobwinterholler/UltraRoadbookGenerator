import type { CompanionVerificationUpdates } from "../types/verification";

/** Human-readable summary lines for a companion verification submission. */
export function summarizeVerificationUpdates(
  updates: CompanionVerificationUpdates,
): string[] {
  const lines: string[] = [];

  if (updates.permanentlyClosed) {
    lines.push("Marked permanently closed");
  } else if (updates.temporarilyClosed) {
    lines.push("Marked temporarily closed");
  } else if (updates.status === "verified") {
    lines.push("Stop confirmed");
  } else if (updates.status === "rejected") {
    lines.push("Issue reported");
  }

  if (updates.openingHoursCorrect === false) {
    lines.push("Opening hours changed");
  } else if (updates.openingHours?.trim()) {
    lines.push("Opening hours updated");
  }

  const services = updates.services;
  if (services) {
    if (services.hasWater) {
      lines.push("Water confirmed");
    }
    if (services.hasFood) {
      lines.push("Food confirmed");
    }
    if (services.hasFuel) {
      lines.push("Fuel confirmed");
    }
    if (services.hasCoffee) {
      lines.push("Coffee confirmed");
    }
    if (services.hasToilet) {
      lines.push("Toilet confirmed");
    }
    if (services.cardPayment) {
      lines.push("Card payment confirmed");
    }
    if (services.indoorSeating) {
      lines.push("Indoor seating confirmed");
    }
    if (services.bikeVisible) {
      lines.push("Bike parking visible");
    }
  }

  if (updates.notes?.trim()) {
    lines.push(updates.notes.trim());
  }

  if (lines.length === 0) {
    lines.push(updates.status === "verified" ? "Verified" : "Rejected");
  }

  return lines;
}

export function verificationSummaryHeadline(updates: CompanionVerificationUpdates): string {
  return summarizeVerificationUpdates(updates)[0] ?? "Verification update";
}
