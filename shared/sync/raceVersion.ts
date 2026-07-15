import type { SyncRaceSummary } from "../types/sync";
import { CURRENT_SCHEMA_VERSION } from "./bundleContract";

/** Normalized race version fields (companion_revision is the source of truth). */
export interface RaceVersionFields {
  version: number;
  bundleVersion: number;
  updatedAt: string | null;
}

export function raceVersionFields(race: {
  companion_revision?: number;
  version?: number;
  bundle_version?: number;
  updated_at?: string | null;
}): RaceVersionFields {
  const revision = race.companion_revision ?? race.version ?? race.bundle_version ?? 0;
  return {
    version: revision,
    bundleVersion: race.bundle_version ?? revision,
    updatedAt: race.updated_at ?? null,
  };
}

export function needsCompanionDownload(
  cloud: SyncRaceSummary,
  downloadedRevision: number | null,
  offlineReady: boolean,
  downloadedChecksum?: string | null,
  downloadedClimbCount?: number | null,
): boolean {
  if (!cloud.has_bundle) {
    return false;
  }
  if (!offlineReady || downloadedRevision === null) {
    return true;
  }
  const { version } = raceVersionFields(cloud);
  if (version > downloadedRevision) {
    return true;
  }
  if (
    version >= downloadedRevision &&
    cloud.bundle_checksum &&
    downloadedChecksum &&
    cloud.bundle_checksum !== downloadedChecksum
  ) {
    return true;
  }
  if (
    cloud.significant_climb_count != null &&
    downloadedClimbCount != null &&
    cloud.significant_climb_count !== downloadedClimbCount
  ) {
    return true;
  }
  const cloudSchema = cloud.bundle_schema_version;
  if (cloudSchema != null && cloudSchema < CURRENT_SCHEMA_VERSION) {
    return true;
  }
  return false;
}

export function needsDesktopUpload(
  local: { id: string; updated_at: string; has_analysis: boolean },
  cloud: SyncRaceSummary | undefined,
  pendingSync: Set<string>,
): boolean {
  if (!local.has_analysis) {
    return false;
  }
  if (pendingSync.has(local.id)) {
    return true;
  }
  if (!cloud) {
    return true;
  }
  if (!cloud.has_bundle) {
    return true;
  }
  const localTime = new Date(local.updated_at).getTime();
  const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
  return localTime > cloudTime + 1000;
}

export function formatUpdateSummary(input: {
  newCount: number;
  updatedCount: number;
  failedCount: number;
}): string {
  const parts: string[] = [];
  if (input.newCount > 0) {
    parts.push(`${input.newCount} new race${input.newCount === 1 ? "" : "s"}`);
  }
  if (input.updatedCount > 0) {
    parts.push(`${input.updatedCount} route${input.updatedCount === 1 ? "" : "s"} updated`);
  }
  if (parts.length === 0 && input.failedCount === 0) {
    return "No updates";
  }
  if (input.failedCount > 0) {
    parts.push(`${input.failedCount} failed`);
  }
  return parts.join(" · ");
}
