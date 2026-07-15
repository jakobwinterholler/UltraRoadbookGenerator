import assert from "node:assert/strict";
import {
  computeStreetViewApproach,
  googleStreetViewUrl,
} from "../shared/race/streetViewUrl.ts";

const route = [
  [7.0, 46.0],
  [7.05, 46.05],
  [7.1, 46.1],
];

const poi = { lat: 46.0512, lon: 7.0525, routeKm: 50, name: "Coop Supermarket" };

const approach = computeStreetViewApproach(
  { ...poi },
  { routeCoordinates: route, totalDistanceKm: 100 },
);

assert.ok(approach.heading >= 0 && approach.heading < 360);
assert.notEqual(approach.viewpoint.lat, poi.lat);
assert.notEqual(approach.viewpoint.lon, poi.lon);

const withPlaceId = googleStreetViewUrl(
  { ...poi, placeId: "ChIJtest123" },
  { routeCoordinates: route, totalDistanceKm: 100 },
);
assert.match(withPlaceId, /query=place_id%3AChIJtest123/);
assert.match(withPlaceId, /heading=\d+/);
assert.doesNotMatch(withPlaceId, /viewpoint=/);

const withoutPlaceId = googleStreetViewUrl(
  { ...poi, placeId: null },
  { routeCoordinates: route, totalDistanceKm: 100 },
);
assert.match(withoutPlaceId, /viewpoint=/);
assert.match(withoutPlaceId, /heading=\d+/);
assert.match(withoutPlaceId, /query=Coop/);
assert.match(withoutPlaceId, /fov=75/);
assert.match(withoutPlaceId, /pitch=0/);

console.log("streetViewUrl tests passed");
