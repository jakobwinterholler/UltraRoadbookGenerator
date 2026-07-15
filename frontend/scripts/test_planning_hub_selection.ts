import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  selectPlanningHubs,
  type PlanningHubBenchmark,
} from "../src/planning/planningHubSelection.ts";
import { presentZones } from "../src/planning/zonePresentation.ts";
import type { RoadbookResult } from "../src/api.ts";

const ROOT = join(import.meta.dirname, "../..");
const RACES_DIR = join(ROOT, "data/races");
const COLLSSEROLA_ID = "626b3103-c50d-49eb-b5de-8a129a5f27f3";
const OILPRIX_OSM_ID = 287007125;
const CAPITALS_ID = "d836e1d9-1fa9-49ea-8476-694c6c00d090";
const CAPITALS_MAX_MS = 20;

function loadRoadbook(raceId: string): RoadbookResult {
  const path = join(ROOT, "data/races", raceId, "analysis/latest.json");
  return JSON.parse(readFileSync(path, "utf8")) as RoadbookResult;
}

function benchmarkRace(label: string, data: RoadbookResult): void {
  const stats: PlanningHubBenchmark = {
    walkSteps: 0,
    spacingCalculations: 0,
    elevationCalculations: 0,
    gravelCalculations: 0,
  };

  const started = performance.now();
  const hubs = selectPlanningHubs(
    data.resupply_zones,
    data.route,
    data.summary.distance_km,
    stats,
  );
  const elapsedMs = performance.now() - started;

  const presented = presentZones(
    data.resupply_zones,
    "day",
    "planning",
    data.summary.distance_km,
    data.route,
  );

  if (hubs.length === 0) {
    throw new Error(`${label}: zero hubs returned`);
  }
  if (hubs.length > data.resupply_zones.length) {
    throw new Error(`${label}: more hubs than zones`);
  }
  if (presented.length !== hubs.length) {
    throw new Error(`${label}: presentZones mismatch (${presented.length} vs ${hubs.length})`);
  }

  if (label === COLLSSEROLA_ID) {
    const hasOilprix = presented.some((zone) =>
      zone.categories.some(
        (group) =>
          group.key === "fuel" &&
          (group.primary?.osm_id === OILPRIX_OSM_ID ||
            group.alternatives.some((option) => option.osm_id === OILPRIX_OSM_ID)),
      ),
    );
    if (!hasOilprix) {
      throw new Error(`${label}: planning hubs dropped Oilprix (zone 4 fuel stop)`);
    }
  }

  const maxMs = label === CAPITALS_ID ? CAPITALS_MAX_MS : 50;
  if (elapsedMs > maxMs) {
    throw new Error(`${label}: ${elapsedMs.toFixed(1)}ms exceeds ${maxMs}ms budget`);
  }

  console.log(`OK ${label}`);
  console.log(`  zones: ${data.resupply_zones.length} -> ${hubs.length} planning hubs`);
  console.log(`  distance: ${data.summary.distance_km.toFixed(0)} km`);
  console.log(`  execution time: ${elapsedMs.toFixed(2)} ms`);
  console.log(`  walk steps (picks): ${stats.walkSteps}`);
  console.log(`  spacing calculations: ${stats.spacingCalculations}`);
  console.log(`  elevation calculations: ${stats.elevationCalculations}`);
  console.log(`  gravel calculations: ${stats.gravelCalculations}`);
  console.log("");
}

const raceIds = readdirSync(RACES_DIR).filter((entry) =>
  existsSync(join(RACES_DIR, entry, "analysis/latest.json")),
);

if (raceIds.length === 0) {
  throw new Error("No saved race analyses found under data/races");
}

console.log("Planning hub selection benchmark\n");

for (const raceId of raceIds) {
  benchmarkRace(raceId, loadRoadbook(raceId));
}

console.log(`Benchmark passed for ${raceIds.length} race(s).`);
