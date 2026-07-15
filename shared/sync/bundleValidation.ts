import type { CompanionBundle } from "../types/sync";
import { computeBundleChecksumSync } from "./bundleChecksum";

export const MIN_COMPANION_SCHEMA_VERSION = 5;

export interface BundleValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCompanionBundle(bundle: unknown): BundleValidationResult {
  const errors: string[] = [];
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, errors: ["Bundle is not an object"] };
  }
  const record = bundle as CompanionBundle;

  if (typeof record.schemaVersion !== "number") {
    errors.push("Missing schemaVersion");
  } else if (record.schemaVersion < MIN_COMPANION_SCHEMA_VERSION) {
    errors.push(`Schema version ${record.schemaVersion} is outdated (need ${MIN_COMPANION_SCHEMA_VERSION}+)`);
  }

  if (!record.generatedAt && !record.exportedAt) {
    errors.push("Missing generatedAt timestamp");
  }

  if (!record.bundleChecksum) {
    errors.push("Missing bundleChecksum");
  }

  if (!record.race?.id || !record.race?.name) {
    errors.push("Missing race metadata");
  }

  if (!Array.isArray(record.stops)) {
    errors.push("Missing stops array");
  }

  if (!Array.isArray(record.route?.coordinates)) {
    errors.push("Missing route coordinates");
  }

  const revision = record.revision ?? record.bundle_version;
  if (revision == null || revision < 0) {
    errors.push("Missing revision");
  }

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
  if (
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
