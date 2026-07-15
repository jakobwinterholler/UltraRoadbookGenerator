import assert from "node:assert/strict";
import {
  computeStreetViewApproach,
  googleStreetViewUrl,
  isGooglePlaceId,
} from "../shared/race/streetViewUrl.ts";

const route = [
  [7.0, 46.0],
  [7.05, 46.05],
  [7.1, 46.1],
];

const poi = { lat: 46.0512, lon: 7.0525, routeKm: 50, name: "Coop Supermarket" };

assert.equal(isGooglePlaceId("ChIJtest1234"), true);
assert.equal(isGooglePlaceId("ChIJ_test_poi"), false);
assert.equal(isGooglePlaceId("osm-node-123"), false);

const approach = computeStreetViewApproach(
  { ...poi },
  { routeCoordinates: route, totalDistanceKm: 100 },
);

assert.ok(approach.heading >= 0 && approach.heading < 360);
assert.equal(approach.viewpoint.lat, poi.lat);
assert.equal(approach.viewpoint.lon, poi.lon);

const withPlaceId = googleStreetViewUrl(
  { ...poi, placeId: "ChIJtest1234" },
  { routeCoordinates: route, totalDistanceKm: 100 },
);
assert.match(withPlaceId, /viewpoint=46\.051200%2C7\.052500/);
assert.match(withPlaceId, /query=place_id%3AChIJtest1234/);
assert.match(withPlaceId, /heading=\d+/);

const withoutPlaceId = googleStreetViewUrl(
  { ...poi, placeId: null },
  { routeCoordinates: route, totalDistanceKm: 100 },
);
assert.match(withoutPlaceId, /viewpoint=/);
assert.match(withoutPlaceId, /heading=\d+/);
assert.doesNotMatch(withoutPlaceId, /query=/);
assert.match(withoutPlaceId, /fov=75/);
assert.match(withoutPlaceId, /pitch=0/);

console.log("streetViewUrl tests passed");
