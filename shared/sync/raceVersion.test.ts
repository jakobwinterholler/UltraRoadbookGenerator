/**
 * Sync race version / download decision tests.
 * Run: npx tsx shared/sync/raceVersion.test.ts
 */

import assert from "node:assert/strict";
import type { SyncRaceSummary } from "../types/sync";
import { needsCompanionDownload } from "./raceVersion";

function baseRace(overrides: Partial<SyncRaceSummary> = {}): SyncRaceSummary {
  return {
    id: "626b3103-c50d-49eb-b5de-8a129a5f27f3",
    name: "Conserolla Runde",
    distance_km: 39.01,
    elevation_gain_m: 727,
    companion_revision: 5,
    updated_at: "2026-07-15T13:02:44+00:00",
    analyzed_at: "2026-07-15T13:02:44+00:00",
    has_bundle: true,
    bundle_checksum: "abc123",
    bundle_schema_version: 5,
    significant_climb_count: 2,
    ...overrides,
  };
}

function testClimbCountMismatchTriggersDownload() {
  const cloud = baseRace({ significant_climb_count: 2 });
  assert.equal(needsCompanionDownload(cloud, 5, true, "abc123", 1), true);
}

function testMatchingClimbCountDoesNotTriggerDownload() {
  const cloud = baseRace({ significant_climb_count: 2 });
  assert.equal(needsCompanionDownload(cloud, 5, true, "abc123", 2), false);
}

function testHigherRevisionStillTriggersDownload() {
  const cloud = baseRace({ companion_revision: 6, significant_climb_count: 2 });
  assert.equal(needsCompanionDownload(cloud, 5, true, "abc123", 2), true);
}

testClimbCountMismatchTriggersDownload();
testMatchingClimbCountDoesNotTriggerDownload();
testHigherRevisionStillTriggersDownload();

console.log("raceVersion.test.ts: all tests passed");
