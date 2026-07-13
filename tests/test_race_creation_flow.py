"""Regression tests for race creation and analysis reliability."""

from __future__ import annotations

import asyncio
import compileall
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from progress import ProgressReporter  # noqa: E402
from race_project import RaceProjectStore  # noqa: E402
from pipeline import analyze_race_gpx  # noqa: E402
import race_project  # noqa: E402
import server  # noqa: E402
from server import _run_race_analysis_with_progress  # noqa: E402

MINIMAL_GPX = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test route</name>
    <trkseg>
      <trkpt lat="47.3769" lon="8.5417"><ele>408</ele></trkpt>
      <trkpt lat="47.3779" lon="8.5517"><ele>418</ele></trkpt>
      <trkpt lat="47.3789" lon="8.5617"><ele>428</ele></trkpt>
    </trkseg>
  </trk>
</gpx>
"""


class BackendImportTests(unittest.TestCase):
    def test_all_backend_modules_compile(self) -> None:
        src = Path(__file__).resolve().parents[1] / "src"
        ok = compileall.compile_dir(src, quiet=1)
        self.assertTrue(ok)

    def test_server_imports(self) -> None:
        import server  # noqa: F401


class RaceProjectStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store = RaceProjectStore(root=Path(self._tmpdir.name) / "races")

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def test_update_preparation(self) -> None:
        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        updated = self.store.update_preparation(race.id, progress={"route_understood": True})
        self.assertTrue(updated.preparation.progress.route_understood)

    def test_update_verified_stops(self) -> None:
        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        updated = self.store.update_preparation(
            race.id,
            verified_stops={
                "12": {
                    "status": "verified",
                    "poi_key": "node-123",
                    "updated_at": "2026-07-08T10:00:00+00:00",
                },
            },
        )
        record = updated.preparation.verified_stops["12"]
        self.assertEqual(record.status, "verified")
        self.assertEqual(record.poi_key, "node-123")

    def test_update_verified_stops_reject_feedback(self) -> None:
        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        updated = self.store.update_preparation(
            race.id,
            verified_stops={
                "7": {
                    "status": "rejected",
                    "reject_reason": "no_shop",
                    "reject_notes": "Fuel-only pumps on Street View",
                    "feedback_context": {
                        "zone_id": 7,
                        "poi_category": "Gas station",
                        "algorithm_targets": ["fuel_shop_confidence"],
                    },
                    "poi_key": "node-456",
                    "updated_at": "2026-07-08T11:00:00+00:00",
                },
            },
        )
        record = updated.preparation.verified_stops["7"]
        self.assertEqual(record.status, "rejected")
        self.assertEqual(record.reject_reason, "no_shop")
        self.assertEqual(record.reject_notes, "Fuel-only pumps on Street View")
        self.assertEqual(record.feedback_context["poi_category"], "Gas station")
        self.assertEqual(record.feedback_context["algorithm_targets"], ["fuel_shop_confidence"])

    def test_update_settings(self) -> None:
        from race_project import RaceSettings

        race = self.store.create_race(filename="test.gpx", gpx_bytes=MINIMAL_GPX, name="Test")
        updated = self.store.update_settings(race.id, RaceSettings(use_app_defaults=False))
        self.assertFalse(updated.settings.use_app_defaults)


class RaceAnalysisFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.store = RaceProjectStore(root=Path(self._tmpdir.name) / "races")
        self._previous_store = race_project.race_store
        race_project.race_store = self.store
        server.race_store = self.store
        self.race = self.store.create_race(
            filename="test-route.gpx",
            gpx_bytes=MINIMAL_GPX,
            name="Regression test race",
        )

    def tearDown(self) -> None:
        race_project.race_store = self._previous_store
        server.race_store = self._previous_store
        self._tmpdir.cleanup()

    def test_analyze_race_gpx_produces_roadbook(self) -> None:
        events: list[dict] = []
        reporter = ProgressReporter(callback=events.append)
        artifacts = analyze_race_gpx(
            self.race.id,
            self.store.get_gpx_path(self.race.id),
            progress=reporter,
        )
        self.assertGreater(len(events), 0)
        self.assertGreater(artifacts.roadbook.summary.distance_km, 0)

    def test_stream_worker_emits_complete_or_error(self) -> None:
        async def collect_events() -> list[dict]:
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue = asyncio.Queue()
            thread = threading.Thread(
                target=_run_race_analysis_with_progress,
                args=(self.race.id, loop, queue),
                daemon=True,
            )
            thread.start()

            events: list[dict] = []
            while True:
                event = await queue.get()
                if event is None:
                    break
                events.append(event)
            thread.join(timeout=120)
            return events

        events = asyncio.run(collect_events())
        self.assertTrue(events, "Analysis worker must emit progress events")

        terminal = [event for event in events if event.get("type") in {"complete", "error"}]
        self.assertEqual(len(terminal), 1, f"Expected one terminal event, got: {terminal}")
        self.assertEqual(terminal[0]["type"], "complete", terminal[0].get("detail"))

        saved = self.store.load_analysis(self.race.id)
        self.assertIsNotNone(saved)
        assert saved is not None
        self.assertIn("summary", saved)


if __name__ == "__main__":
    unittest.main()
