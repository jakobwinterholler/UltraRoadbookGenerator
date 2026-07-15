import type { CompanionBundle } from "../types/sync";
import { computeBundleChecksumSync } from "./bundleChecksum";
import { CURRENT_SCHEMA_VERSION } from "./bundleContract";

export interface BundleValidationResult {
  valid: boolean;
  errors: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Detailed diagnostics before migration — used in sync debug logs. */
export function diagnoseCompanionBundle(bundle: unknown): string[] {
  const issues: string[] = [];
  if (!bundle || typeof bundle !== "object") {
    return ["Bundle is not an object"];
  }
  const record = bundle as CompanionBundle;

  if (typeof record.schemaVersion !== "number") {
    issues.push('Missing field "schemaVersion"');
  } else if (record.schemaVersion < CURRENT_SCHEMA_VERSION) {
    issues.push(
      `Unsupported schema version ${record.schemaVersion} (need ${CURRENT_SCHEMA_VERSION}+)`,
    );
  }

  if (!record.generatedAt && !record.exportedAt) {
    issues.push('Missing field "generatedAt"');
  }
  if (!record.bundleChecksum) {
    issues.push('Missing field "bundleChecksum"');
  }

  const race = asRecord(record.race);
  if (!race?.id) {
    issues.push('Missing field "race.id"');
  }
  if (!race?.name) {
    issues.push('Missing field "race.name"');
  }
  if (race?.distanceKm == null && race?.distance_km == null) {
    issues.push('Missing field "race.distanceKm"');
  }

  if (!Array.isArray(record.stops)) {
    issues.push('Missing field "stops" (array)');
  } else {
    record.stops.forEach((stop, index) => {
      if (stop.lat == null || stop.lon == null) {
        issues.push(`Stop ${index + 1} missing coordinates`);
      }
      if (!stop.name) {
        issues.push(`Stop ${index + 1} missing name`);
      }
      if (stop.zoneId == null) {
        issues.push(`Stop ${index + 1} missing zoneId`);
      }
    });
  }

  if (!Array.isArray(record.route?.coordinates)) {
    issues.push('Missing field "route.coordinates"');
  } else if (record.route.coordinates.length === 0) {
    issues.push("Route coordinates array is empty");
  }

  if (!Array.isArray(record.climbs)) {
    issues.push('Missing field "climbs" (array)');
  }

  if (!Array.isArray(record.unsupportedSections)) {
    issues.push('Missing field "unsupportedSections" (array)');
  }

  const revision = record.revision ?? record.bundle_version;
  if (revision == null || revision < 0) {
    issues.push('Missing field "revision"');
  }

  return issues;
}

export function validateCompanionBundle(bundle: unknown): BundleValidationResult {
  const errors = diagnoseCompanionBundle(bundle);
  return { valid: errors.length === 0, errors };
}

export function bundleNeedsUpdate(input: {
  cloudRevision: number;
  cloudChecksum: string | null | undefined;
  localRevision: number | null;
  localChecksum: string | null | undefined;
  offlineReady: boolean;
}): boolean {
  if (!input.offlineReady || input.localRevision === null) {
    return true;
  }
  if (input.cloudRevision > input.localRevision) {
    return true;
  }
  // Local verification bumps checksum before cloud sync completes — do not
  // treat that drift as a stale bundle when local revision is already ahead.
  if (
    input.cloudRevision >= input.localRevision &&
    input.cloudChecksum &&
    input.localChecksum &&
    input.cloudChecksum !== input.localChecksum
  ) {
    return true;
  }
  return false;
}

export function verifyStoredChecksum(bundle: CompanionBundle): boolean {
  const stored = bundle.bundleChecksum;
  if (!stored) {
    return false;
  }
  const computed = computeBundleChecksumSync(bundle);
  return computed === stored;
}
