/**
 * Street View URL regression tests.
 * Run: npx tsx shared/race/streetViewUrl.test.ts
 */

import assert from "node:assert/strict";
import {
  bearingBetween,
  buildStreetViewUrlFromPanorama,
  computeStreetViewApproach,
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

function testViewpointUsesRouteApproachNotPoi() {
  const url = googleStreetViewUrl(OILPRIX, {
    routeCoordinates: COLLserola_ROUTE,
    totalDistanceKm: 39,
  });

  const approach = computeStreetViewApproach(OILPRIX, {
    routeCoordinates: COLLserola_ROUTE,
    totalDistanceKm: 39,
  });

  assert.match(
    url,
    new RegExp(`viewpoint=${approach.viewpoint.lat.toFixed(6)}%2C${approach.viewpoint.lon.toFixed(6)}`),
  );
  assert.doesNotMatch(url, /viewpoint=41\.430306%2C2\.128889/);
  assert.match(url, /heading=/);
  assert.doesNotMatch(url, /query=/);
}

function testPanoramaHeadingFacesPoi() {
  const panorama = { lat: 41.4301, lon: 2.1285 };
  const poi = { lat: OILPRIX.lat, lon: OILPRIX.lon };
  const expectedHeading = Math.round(bearingBetween(panorama, poi));

  const url = buildStreetViewUrlFromPanorama(panorama, poi, {
    panoId: "tu510ie_z4ptBZYo2BGEJg",
  });
  assert.match(url, /viewpoint=41\.430100%2C2\.128500/);
  assert.match(url, new RegExp(`heading=${expectedHeading}`));
  assert.match(url, /pano=tu510ie_z4ptBZYo2BGEJg/);
  assert.doesNotMatch(url, /query=/);
}

function testStreetViewNeverUsesPlaceQuery() {
  const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const url = googleStreetViewUrl({
    lat: OILPRIX.lat,
    lon: OILPRIX.lon,
    name: "Oilprix",
    placeId,
  });

  assert.match(url, /map_action=pano/);
  assert.doesNotMatch(url, /query=/);
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
        pano_id: "tu510ie_z4ptBZYo2BGEJg",
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
    assert.match(resolved.streetViewUrl!, /pano=tu510ie_z4ptBZYo2BGEJg/);
    assert.doesNotMatch(resolved.streetViewUrl!, /query=/);
    assert.equal(resolved.debug.poiLat, OILPRIX.lat);
    assert.equal(resolved.debug.panoramaLat, 41.4301);
    assert.ok(resolved.debug.heading != null);
    assert.ok(resolved.debug.panoramaDistanceFromPoiM! <= STREET_VIEW_SEARCH_RADIUS_M);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testResolveStreetViewFallbackWhenMetadataDenied() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message: "You must use an API key",
      }),
    }) as Response;

  try {
    const resolved = await resolveStreetView(OILPRIX, {
      routeCoordinates: COLLserola_ROUTE,
      totalDistanceKm: 39,
    });
    assert.equal(resolved.available, true);
    assert.ok(resolved.streetViewUrl);
    assert.doesNotMatch(resolved.streetViewUrl!, /query=/);
    assert.equal(resolved.debug.status, "UNKNOWN");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testResolveStreetViewFallbackWhenFetchFails() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network");
  };

  try {
    const resolved = await resolveStreetView(OILPRIX);
    assert.equal(resolved.available, true);
    assert.ok(resolved.streetViewUrl);
    assert.match(resolved.streetViewUrl!, /map_action=pano/);
    assert.doesNotMatch(resolved.streetViewUrl!, /query=/);
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

testViewpointUsesRouteApproachNotPoi();
testPanoramaHeadingFacesPoi();
testStreetViewNeverUsesPlaceQuery();
testParseStreetViewMetadata();
testCollserolaOilprixGpxDiffersFromPoi();
await testResolveStreetViewLogsAndUsesPoiSearch();
await testResolveStreetViewFallbackWhenMetadataDenied();
await testResolveStreetViewFallbackWhenFetchFails();
await testResolveStreetViewFallbackWhenNoCoverage();

console.log("streetViewUrl.test.ts: all tests passed");
