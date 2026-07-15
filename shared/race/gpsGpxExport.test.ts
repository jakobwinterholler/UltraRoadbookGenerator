/**
 * Coros GPX export v3.0 unit tests — parity with tests/test_race_gpx_export.py
 * Run: npx tsx shared/race/gpsGpxExport.test.ts
 */

import assert from "node:assert/strict";
import {
  isInvalidExportName,
  resolveCorosWptIcon,
  ROUTE_INTEGRITY_FAILED_MESSAGE,
  smartPoiLabel,
} from "./gpsGpxExportConstants";
import { GpxTrackModifiedError } from "./gpsGpxExport";

function testSmartNames() {
  assert.equal(smartPoiLabel({ name: "Repsol", brand: "Repsol", category: "Gas station" }), "Repsol");
  assert.equal(
    smartPoiLabel({ name: "Font de Prades", brand: null, category: "Drinking water" }),
    "Font de Prades",
  );
  assert.equal(smartPoiLabel({ name: "Unnamed", brand: null, category: "Gas station", hasFuel: true }), "Fuel");
  assert.equal(isInvalidExportName("Checkpoint 8"), true);
  assert.equal(isInvalidExportName("Carretera de la Marina"), true);
}

function testCorosIcons() {
  assert.equal(resolveCorosWptIcon({ category: "Drinking water", hasWater: true }), "Water");
  assert.equal(resolveCorosWptIcon({ category: "Gas station", hasFuel: true }), "Supplies");
  assert.equal(resolveCorosWptIcon({ category: "Supermarket", hasFood: true }), "Supplies");
  assert.equal(resolveCorosWptIcon({ category: "Café" }), "Supplies");
  assert.equal(resolveCorosWptIcon({ category: "Hazard" }), "Hazard");
  assert.equal(resolveCorosWptIcon({ category: "Generic POI" }), "Pin");
}

function testIntegrityMessage() {
  const error = new GpxTrackModifiedError();
  assert.equal(error.message, ROUTE_INTEGRITY_FAILED_MESSAGE);
}

testSmartNames();
testCorosIcons();
testIntegrityMessage();
console.log("gpsGpxExport.test.ts: all tests passed");
