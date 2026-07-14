import assert from "node:assert/strict";
import {
  buildRouteTrack,
  haversineM,
  matchPositionToRoute,
  PositionSmoother,
} from "../shared/race/mapMatching.ts";

function testHaversine() {
  const parisLondon = haversineM(48.8566, 2.3522, 51.5074, -0.1278);
  assert.ok(parisLondon > 300_000 && parisLondon < 400_000, `unexpected distance ${parisLondon}`);
}

function testBuildRouteTrack() {
  const track = buildRouteTrack(
    [
      [0, 0],
      [0, 0.01],
      [0, 0.02],
    ],
    2.2,
  );
  assert.equal(track.points.length, 3);
  assert.ok(Math.abs(track.totalKm - 2.2) < 0.01);
  assert.equal(track.points[0].km, 0);
  assert.ok(track.points[2].km > track.points[1].km);
}

function testMatchPositionOnRoute() {
  const track = buildRouteTrack(
    [
      [8.5, 47.3],
      [8.51, 47.31],
      [8.52, 47.32],
    ],
    5,
  );
  const mid = track.points[1];
  const matched = matchPositionToRoute(mid.lat + 0.00005, mid.lon + 0.00005, track);
  assert.ok(matched);
  assert.ok(matched.snapDistanceM < 30);
  assert.ok(matched.km > 1 && matched.km < 4);
}

function testPositionSmoother() {
  const smoother = new PositionSmoother(0.5);
  const first = smoother.smooth(47, 8, 10);
  const second = smoother.smooth(47.001, 8.001, 10.5);
  assert.ok(second.km > first.km && second.km < 10.5);
}

testHaversine();
testBuildRouteTrack();
testMatchPositionOnRoute();
testPositionSmoother();

console.log("mapMatching tests passed");
