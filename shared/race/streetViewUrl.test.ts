/**
 * Street View URL regression tests.
 * Run: npx tsx shared/race/streetViewUrl.test.ts
 */

import assert from "node:assert/strict";
import {
  bearingBetween,
  buildStreetViewUrlFromPanorama,
  googleStreetViewUrl,
  gpxPointAtStopKm,
  parseStreetViewMetadataStatus,
  resolveStreetView,
  STREET_VIEW_SEARCH_RADIUS_M,
} from "./streetViewUrl";

const COLLserola_ROUTE: [number, number][] = [
  [2.1, 41.4],
  [2.128, 41.43],
  [2.2, 41.5],
];

const OILPRIX = {
  lat: 41.430306,
  lon: 2.128889,
  routeKm: 6.96,
  name: "Oilprix",
  placeId: "node/287007125",
};

function testViewpointUsesPoiNotGpx() {
  const url = googleStreetViewUrl(OILPRIX, {
    routeCoordinates: COLLserola_ROUTE,
    totalDistanceKm: 39,
  });

  const gpx = gpxPointAtStopKm(OILPRIX, {
    routeCoordinates: COLLserola_ROUTE,
    totalDistanceKm: 39,
  });
  assert.ok(gpx);

  assert.match(url, /viewpoint=41\.430306%2C2\.128889/);
  assert.doesNotMatch(url, new RegExp(`viewpoint=${gpx!.lat.toFixed(6)}`.replace(".", "\\.")));
  assert.match(url, /heading=/);
  assert.match(url, /query=Oilprix/);
  assert.doesNotMatch(url, /place_id:/);
}

function testPanoramaHeadingFacesPoi() {
  const panorama = { lat: 41.4301, lon: 2.1285 };
  const poi = { lat: OILPRIX.lat, lon: OILPRIX.lon };
  const expectedHeading = Math.round(bearingBetween(panorama, poi));

  const url = buildStreetViewUrlFromPanorama(panorama, poi, { name: "Oilprix" });
  assert.match(url, /viewpoint=41\.430100%2C2\.128500/);
  assert.match(url, new RegExp(`heading=${expectedHeading}`));
}

function testStreetViewUsesPlaceIdWhenValid() {
  const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const url = googleStreetViewUrl({
    lat: OILPRIX.lat,
    lon: OILPRIX.lon,
    name: "Oilprix",
    placeId,
  });

  assert.match(url, /viewpoint=41\.430306%2C2\.128889/);
  assert.match(url, /query=place_id%3AChIJN1t_tDeuEmsRUsoyG83frY4/);
}

function testParseStreetViewMetadata() {
  assert.equal(parseStreetViewMetadataStatus("OK").available, true);
  assert.equal(parseStreetViewMetadataStatus("ZERO_RESULTS").available, false);
  assert.equal(parseStreetViewMetadataStatus("REQUEST_DENIED").status, "UNKNOWN");
}

function testCollserolaOilprixGpxDiffersFromPoi() {
  const gpx = gpxPointAtStopKm(OILPRIX, {
    routeCoordinates: COLLserola_ROUTE,
    totalDistanceKm: 39,
  });
  assert.ok(gpx);
  const distanceM = Math.hypot(
    (gpx!.lat - OILPRIX.lat) * 111_000,
    (gpx!.lon - OILPRIX.lon) * 85_000,
  );
  assert.ok(distanceM > 5, "Oilprix should be off-route from GPX interpolation");
}

async function testResolveStreetViewLogsAndUsesPoiSearch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: "OK",
        location: { lat: 41.4301, lng: 2.1285 },
      }),
    }) as Response;

  try {
    const resolved = await resolveStreetView(OILPRIX, {
      routeCoordinates: COLLserola_ROUTE,
      totalDistanceKm: 39,
    });
    assert.equal(resolved.available, true);
    assert.ok(resolved.streetViewUrl);
    assert.match(resolved.streetViewUrl!, /viewpoint=41\.430100%2C2\.128500/);
    assert.equal(resolved.debug.poiLat, OILPRIX.lat);
    assert.equal(resolved.debug.panoramaLat, 41.4301);
    assert.ok(resolved.debug.heading != null);
    assert.ok(resolved.debug.panoramaDistanceFromPoiM! <= STREET_VIEW_SEARCH_RADIUS_M);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testResolveStreetViewFallbackWhenNoCoverage() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS" }),
    }) as Response;

  try {
    const resolved = await resolveStreetView(OILPRIX);
    assert.equal(resolved.available, false);
    assert.equal(resolved.streetViewUrl, null);
    assert.match(resolved.mapsFallbackUrl, /google\.com\/maps/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testViewpointUsesPoiNotGpx();
testPanoramaHeadingFacesPoi();
testStreetViewUsesPlaceIdWhenValid();
testParseStreetViewMetadata();
testCollserolaOilprixGpxDiffersFromPoi();
await testResolveStreetViewLogsAndUsesPoiSearch();
await testResolveStreetViewFallbackWhenNoCoverage();

console.log("streetViewUrl.test.ts: all tests passed");
