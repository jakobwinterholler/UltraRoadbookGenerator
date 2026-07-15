"""Tests for Companion bundle builder."""

from __future__ import annotations

import unittest

from companion_bundle import COMPANION_SCHEMA_VERSION, build_companion_bundle


class CompanionBundleTests(unittest.TestCase):
    def test_build_companion_bundle_minimal(self):
        roadbook = {
            "summary": {
                "route_name": "Test Route",
                "distance_km": 100.0,
                "elevation_gain_m": 2000.0,
            },
            "route": {
                "track_points": [
                    {"lat": 46.0, "lon": 7.0},
                    {"lat": 46.1, "lon": 7.1},
                ],
            },
            "resupply_zones": [
                {
                    "zone_id": 1,
                    "distance_along_km": 50.0,
                    "lat": 46.05,
                    "lon": 7.05,
                    "name": "Stop 1",
                    "categories": [
                        {
                            "key": "water",
                            "label": "Water",
                            "primary": {
                                "osm_id": 1,
                                "osm_type": "node",
                                "name": "Fountain",
                                "poi_category": "water",
                                "opening_hours": "24/7",
                                "lat": 46.051,
                                "lon": 7.051,
                                "tags": {"google_place_id": "ChIJtest1234"},
                            },
                        }
                    ],
                }
            ],
        }
        preparation = {
            "verified_stops": {
                "1": {"status": "verified", "reject_notes": "Good stop"},
            }
        }

        bundle = build_companion_bundle("test-id", roadbook, preparation, revision=3)

        self.assertEqual(bundle["schemaVersion"], COMPANION_SCHEMA_VERSION)
        self.assertEqual(bundle["revision"], 3)
        self.assertEqual(bundle["bundle_version"], 3)
        self.assertTrue(bundle.get("bundleChecksum"))
        self.assertTrue(bundle.get("generatedAt"))
        self.assertEqual(bundle["race"]["name"], "Test Route")
        self.assertEqual(len(bundle["stops"]), 1)
        self.assertEqual(bundle["stops"][0]["poiId"], "poi_1")
        self.assertEqual(bundle["stops"][0]["verificationStatus"], "verified")
        self.assertEqual(bundle["stops"][0]["notes"], "Good stop")
        self.assertTrue(bundle["stops"][0]["hasWater"])
        self.assertEqual(bundle["stops"][0]["lat"], 46.051)
        self.assertEqual(bundle["stops"][0]["lon"], 7.051)
        self.assertEqual(bundle["stops"][0]["placeId"], "ChIJtest1234")
        self.assertEqual(bundle["climbs"], [])
        self.assertGreaterEqual(bundle["dashboardStats"]["readinessScore"], 0)
        self.assertEqual(len(bundle["route"]["coordinates"]), 2)


if __name__ == "__main__":
    unittest.main()
