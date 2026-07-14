"""Tests for companion verification queue on local race store."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from race_project import RaceProjectStore  # noqa: E402

MINIMAL_GPX = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test route</name>
    <trkseg>
      <trkpt lat="47.3769" lon="8.5417"><ele>408</ele></trkpt>
      <trkpt lat="47.3779" lon="8.5517"><ele>418</ele></trkpt>
    </trkseg>
  </trk>
</gpx>
"""


class CompanionVerificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = RaceProjectStore(root=Path(self.tmp.name) / "races")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_add_queues_pending_verification(self) -> None:
        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        race_id = race.id
        accepted = self.store.add_companion_verifications(
            race_id,
            [
                {
                    "id": "v1",
                    "raceId": race_id,
                    "zoneId": 3,
                    "stopName": "Test Stop",
                    "submittedAt": "2026-07-14T00:00:00Z",
                    "source": "companion",
                    "reviewStatus": "pending",
                    "updates": {"status": "verified", "notes": "Looks good"},
                }
            ],
        )
        self.assertEqual(accepted, ["v1"])

        pending = self.store.list_companion_verifications(race_id, status="pending")
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["reviewStatus"], "pending")
        self.assertEqual(pending[0]["id"], "v1")

        race = self.store.get_race(race_id)
        self.assertNotIn("3", race.preparation.verified_stops)

        reviewed = self.store.review_companion_verification(race_id, "v1", action="accept")
        self.assertIsNotNone(reviewed)
        race = self.store.get_race(race_id)
        self.assertIn("3", race.preparation.verified_stops)
        self.assertEqual(race.preparation.verified_stops["3"].status, "verified")
        self.assertEqual(self.store.list_companion_verifications(race_id, status="pending"), [])

    def test_review_still_works_for_legacy_pending(self) -> None:
        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        race_id = race.id
        from race_project import CompanionVerificationRecord

        pending = CompanionVerificationRecord(
            id="legacy",
            race_id=race_id,
            zone_id=5,
            stop_name="Legacy Stop",
            submitted_at="2026-07-14T00:00:00Z",
            updates={"status": "verified"},
        )
        race = self.store.get_race(race_id)
        race.preparation.companion_pending_verifications["legacy"] = pending
        self.store._save_race(race)

        updated = self.store.review_companion_verification(race_id, "legacy", action="accept")
        self.assertIsNotNone(updated)
        race = self.store.get_race(race_id)
        self.assertIn("5", race.preparation.verified_stops)


if __name__ == "__main__":
    unittest.main()
