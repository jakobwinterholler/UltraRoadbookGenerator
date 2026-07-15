"""Tests for bundle checksum stability."""

from __future__ import annotations

import unittest

from bundle_checksum import compute_bundle_checksum


class BundleChecksumTests(unittest.TestCase):
    def test_checksum_stable_across_synced_at_change(self) -> None:
        bundle_a = {
            "schemaVersion": 5,
            "revision": 3,
            "generatedAt": "2026-07-15T10:00:00+00:00",
            "syncedAt": "2026-07-15T10:00:00+00:00",
            "exportedAt": "2026-07-15T10:00:00+00:00",
            "race": {"id": "race-1", "name": "Test"},
            "stops": [],
            "route": {"coordinates": [[1, 2]], "bounds": {}},
        }
        bundle_b = {**bundle_a, "syncedAt": "2026-07-15T11:00:00+00:00"}
        self.assertEqual(compute_bundle_checksum(bundle_a), compute_bundle_checksum(bundle_b))

    def test_checksum_changes_when_stops_change(self) -> None:
        base = {
            "schemaVersion": 5,
            "revision": 3,
            "generatedAt": "2026-07-15T10:00:00+00:00",
            "race": {"id": "race-1", "name": "Test"},
            "stops": [],
            "route": {"coordinates": [[1, 2]], "bounds": {}},
        }
        changed = {**base, "stops": [{"zoneId": 1, "name": "Stop"}]}
        self.assertNotEqual(compute_bundle_checksum(base), compute_bundle_checksum(changed))


if __name__ == "__main__":
    unittest.main()
