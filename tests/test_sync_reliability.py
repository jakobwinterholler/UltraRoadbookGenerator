"""Tests for sync versioning and companion bundle alternatives."""

from __future__ import annotations

from datetime import datetime, timezone
import unittest
from unittest.mock import MagicMock, patch

from companion_bundle import COMPANION_SCHEMA_VERSION, build_companion_bundle


class CompanionBundleAlternativeTests(unittest.TestCase):
    def test_build_companion_bundle_exports_alternatives(self):
        roadbook = {
            "summary": {
                "route_name": "Alt Route",
                "distance_km": 80.0,
                "elevation_gain_m": 1500.0,
            },
            "route": {
                "track_points": [
                    {"lat": 46.0, "lon": 7.0, "ele_m": 500},
                    {"lat": 46.1, "lon": 7.1, "ele_m": 600},
                ],
            },
            "resupply_zones": [
                {
                    "zone_id": 1,
                    "distance_along_km": 40.0,
                    "lat": 46.05,
                    "lon": 7.05,
                    "name": "KM 40",
                    "categories": [
                        {
                            "key": "food",
                            "label": "Food",
                            "primary": {
                                "osm_id": 1,
                                "osm_type": "node",
                                "name": "Shop A",
                                "poi_category": "Supermarket",
                                "distance_off_route_m": 120,
                                "distance_along_km": 40.0,
                                "score": 55,
                                "lat": 46.051,
                                "lon": 7.051,
                            },
                            "alternatives": [
                                {
                                    "osm_id": 2,
                                    "osm_type": "node",
                                    "name": "Shop B",
                                    "poi_category": "Convenience",
                                    "distance_off_route_m": 80,
                                    "distance_along_km": 40.1,
                                    "score": 48,
                                    "lat": 46.052,
                                    "lon": 7.052,
                                }
                            ],
                        },
                        {
                            "key": "water",
                            "label": "Water",
                            "primary": {
                                "osm_id": 3,
                                "osm_type": "node",
                                "name": "Fountain",
                                "poi_category": "Drinking water",
                                "distance_off_route_m": 30,
                                "distance_along_km": 39.9,
                                "score": 62,
                                "lat": 46.050,
                                "lon": 7.050,
                            },
                            "alternatives": [],
                        },
                    ],
                }
            ],
        }

        bundle = build_companion_bundle("alt-route", roadbook, {}, revision=5)

        self.assertEqual(bundle["schemaVersion"], COMPANION_SCHEMA_VERSION)
        self.assertEqual(bundle["revision"], 5)
        self.assertEqual(bundle["bundle_version"], 5)
        self.assertTrue(bundle.get("bundleChecksum"))
        stop = bundle["stops"][0]
        self.assertEqual(stop["osmId"], 3)
        self.assertEqual(stop["name"], "Fountain")
        self.assertGreaterEqual(len(stop["alternatives"]), 1)
        self.assertIn(stop["alternatives"][0]["osmId"], (1, 2))


class RaceSyncReliabilityTests(unittest.TestCase):
    def test_push_all_skips_unchanged_races(self):
        from cloud import race_sync

        existing_row = {
            "companion_revision": 2,
            "has_bundle": True,
            "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
        }
        summary = MagicMock()
        summary.id = "race-1"
        summary.name = "Test"
        summary.updated_at = datetime(2025, 12, 1, tzinfo=timezone.utc).isoformat()

        with patch.object(race_sync.race_store, "list_races", return_value=[summary]), patch.object(
            race_sync, "_get_race_row", return_value=existing_row
        ), patch.object(race_sync, "push_race") as push_mock:
            result = race_sync.push_all_local_races("user-1", "token")

        push_mock.assert_not_called()
        self.assertEqual(
            result["skipped"],
            [{"race_id": "race-1", "name": "Test", "reason": "unchanged"}],
        )
        self.assertEqual(result["uploaded"], [])
        self.assertEqual(result["failed"], [])

    def test_push_race_returns_version_fields(self):
        from cloud import race_sync

        race = MagicMock()
        race.preparation.to_dict.return_value = {}
        race.analysis = {"analyzed_at": None}

        summary = MagicMock()
        summary.name = "Versioned"
        summary.distance_km = 100
        summary.elevation_gain_m = 1000

        with patch.object(race_sync.race_store, "get_race", return_value=race), patch.object(
            race_sync.race_store, "get_summary", return_value=summary
        ), patch.object(race_sync.race_store, "get_gpx_path") as gpx_mock, patch.object(
            race_sync.race_store, "load_analysis", return_value=None
        ), patch.object(
            race_sync, "_get_race_row", return_value={"companion_revision": 4}
        ), patch.object(
            race_sync, "_upsert_race_row", return_value={"companion_revision": 4}
        ), patch.object(race_sync, "_upload_bytes"):
            gpx_path = MagicMock()
            gpx_path.exists.return_value = False
            gpx_mock.return_value = gpx_path
            result = race_sync.push_race("user-1", "race-1")

        self.assertEqual(result["companion_revision"], 4)
        self.assertEqual(result["version"], 4)
        self.assertEqual(result["bundle_version"], 4)
        self.assertEqual(result["name"], "Versioned")


if __name__ == "__main__":
    unittest.main()
