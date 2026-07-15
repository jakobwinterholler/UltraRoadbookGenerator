"""Tests for climb detection acceptance rules."""

import unittest
from pathlib import Path

from climb_config import DEFAULT_CLIMB_DETECTION_CONFIG
from climb_detector import detect_climbs_with_debug
from gpx_parser import parse_gpx_track


class ClimbDetectorTests(unittest.TestCase):
    def test_barcelona_route_detects_multiple_climbs(self) -> None:
        gpx_path = Path("data/races/626b3103-c50d-49eb-b5de-8a129a5f27f3/route.gpx")
        if not gpx_path.is_file():
            self.skipTest("Barcelona sample route not available")

        track = parse_gpx_track(gpx_path)
        climbs, candidates = detect_climbs_with_debug(track, DEFAULT_CLIMB_DETECTION_CONFIG)

        accepted = [candidate for candidate in candidates if candidate.status == "accepted"]
        self.assertGreaterEqual(len(climbs), 3)
        self.assertGreaterEqual(len(accepted), 3)

        gains = sorted(climb.elevation_gain_m for climb in climbs)
        self.assertIn(390, [round(gain) for gain in gains])
        self.assertTrue(any(gain >= 250 for gain in gains))


if __name__ == "__main__":
    unittest.main()
