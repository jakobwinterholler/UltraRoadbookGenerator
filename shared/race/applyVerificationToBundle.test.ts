/**
 * Verification bundle patch regression tests.
 * Run: npx tsx shared/race/applyVerificationToBundle.test.ts
 */

import assert from "node:assert/strict";
import type { CompanionBundle } from "../types/sync";
import type { CompanionVerificationSubmission } from "../types/verification";
import { applyVerificationToBundle } from "./applyVerificationToBundle";

function makeBundle(): CompanionBundle {
  return {
    schemaVersion: 5,
    revision: 1,
    generatedAt: "2026-07-15T12:00:00+00:00",
    exportedAt: "2026-07-15T12:00:00+00:00",
    bundleChecksum: "test",
    race: {
      id: "race-1",
      name: "Test",
      distanceKm: 40,
      elevationGainM: 900,
      analyzedAt: "2026-07-15T10:00:00+00:00",
    },
    route: {
      coordinates: [
        [2.1, 41.4],
        [2.2, 41.5],
      ],
      bounds: { south: 41.3, west: 2.0, north: 41.6, east: 2.3 },
    },
    stops: [
      {
        poiId: "poi_287007125",
        zoneId: 4,
        osmId: 287007125,
        osmType: "node",
        km: 6.96,
        lat: 41.430306,
        lon: 2.128889,
        name: "Oilprix",
        category: "Gas station",
        categoryLabel: "Water · Fuel",
        icon: "⛽",
        verificationStatus: "verified",
        openingHours: "24/7",
        notes: null,
        hasFuel: true,
        hasWater: true,
        alternatives: [
          {
            poiId: "poi_5840105162",
            osmId: 5840105162,
            osmType: "node",
            name: "Font del Roure",
            category: "Drinking water",
            categoryLabel: "Water",
            icon: "💧",
            distanceOffRouteM: 92,
            distanceAlongKm: 6.65,
            score: 36.6,
            verificationStatus: "unverified",
            openingHours: null,
            lat: 41.428907,
            lon: 2.128991,
            hasWater: true,
          },
        ],
      },
    ],
    unsupportedSections: [],
  };
}

function makeSubmission(
  poiId: string,
  zoneId: number,
): CompanionVerificationSubmission {
  return {
    id: "sub-1",
    raceId: "race-1",
    zoneId,
    poiId,
    stopName: "Font del Roure",
    submittedAt: "2026-07-15T13:00:00+00:00",
    source: "companion",
    reviewStatus: "pending",
    updates: { status: "verified" },
  };
}

function testAlternativeVerificationPatchesNestedPoi() {
  const bundle = makeBundle();
  const next = applyVerificationToBundle(bundle, makeSubmission("poi_5840105162", 4));

  assert.equal(next.stops[0]!.verificationStatus, "verified");
  assert.equal(next.stops[0]!.alternatives?.[0]?.verificationStatus, "pending");
}

function testPrimaryVerificationDoesNotPatchAlternative() {
  const bundle = makeBundle();
  bundle.stops[0]!.verificationStatus = "unverified";
  const next = applyVerificationToBundle(bundle, makeSubmission("poi_287007125", 4));

  assert.equal(next.stops[0]!.verificationStatus, "pending");
  assert.equal(next.stops[0]!.alternatives?.[0]?.verificationStatus, "unverified");
}

testAlternativeVerificationPatchesNestedPoi();
testPrimaryVerificationDoesNotPatchAlternative();

console.log("applyVerificationToBundle.test.ts: all tests passed");
