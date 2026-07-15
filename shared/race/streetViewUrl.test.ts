/**
 * Street View URL regression tests.
 * Run: npx tsx shared/race/streetViewUrl.test.ts
 */

import assert from "node:assert/strict";
import { computeStreetViewApproach, googleStreetViewUrl, parseStreetViewMetadataStatus } from "./streetViewUrl";

function testRouteViewpointFacesPoi() {
  const routeCoordinates: [number, number][] = [
    [2.1, 41.4],
    [2.128, 41.43],
    [2.2, 41.5],
  ];
  const poiLat = 41.430306;
  const poiLon = 2.128889;
  const routeKm = 6.96;

  const approach = computeStreetViewApproach(
    { lat: poiLat, lon: poiLon, routeKm },
    { routeCoordinates, totalDistanceKm: 39 },
  );

  assert.notEqual(approach.viewpoint.lat, poiLat);
  assert.notEqual(approach.viewpoint.lon, poiLon);
  assert.ok(approach.heading >= 0 && approach.heading < 360);
}

function testStreetViewUsesNameQueryWithoutPlaceId() {
  const url = googleStreetViewUrl(
    {
      lat: 41.430306,
      lon: 2.128889,
      routeKm: 6.96,
      name: "Oilprix",
      placeId: "node/287007125",
    },
    {
      routeCoordinates: [
        [2.1, 41.4],
        [2.128, 41.43],
      ],
      totalDistanceKm: 39,
    },
  );

  assert.match(url, /viewpoint=/);
  assert.match(url, /heading=/);
  assert.match(url, /query=Oilprix/);
  assert.doesNotMatch(url, /place_id:/);
}

function testStreetViewUsesPlaceIdWhenValid() {
  const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const url = googleStreetViewUrl({
    lat: 41.430306,
    lon: 2.128889,
    name: "Oilprix",
    placeId,
  });

  assert.match(url, /query=place_id%3AChIJN1t_tDeuEmsRUsoyG83frY4/);
}

function testParseStreetViewMetadata() {
  assert.equal(parseStreetViewMetadataStatus("OK").available, true);
  assert.equal(parseStreetViewMetadataStatus("ZERO_RESULTS").available, false);
  assert.equal(parseStreetViewMetadataStatus("REQUEST_DENIED").status, "UNKNOWN");
}

testRouteViewpointFacesPoi();
testStreetViewUsesNameQueryWithoutPlaceId();
testStreetViewUsesPlaceIdWhenValid();
testParseStreetViewMetadata();

console.log("streetViewUrl.test.ts: all tests passed");
