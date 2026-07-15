"""Tests for Companion bundle builder."""

from __future__ import annotations

import json
from pathlib import Path

from companion_bundle import COMPANION_SCHEMA_VERSION, build_companion_bundle


FIXTURE = Path(__file__).resolve().parent.parent / "data" / "races"


def test_build_companion_bundle_minimal():
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
                            "name": "Fountain",
                            "poi_category": "water",
                            "opening_hours": "24/7",
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

    assert bundle["schemaVersion"] == COMPANION_SCHEMA_VERSION
    assert bundle["revision"] == 3
    assert bundle["race"]["name"] == "Test Route"
    assert len(bundle["stops"]) == 1
    assert bundle["stops"][0]["verificationStatus"] == "verified"
    assert bundle["stops"][0]["notes"] == "Good stop"
    assert bundle["stops"][0]["hasWater"] is True
    assert bundle["climbs"] == []
    assert bundle["dashboardStats"]["readinessScore"] >= 0
    assert len(bundle["route"]["coordinates"]) == 2
