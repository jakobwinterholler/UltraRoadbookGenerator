"""Tests for significant climb filtering."""

import unittest

from significant_climbs import is_significant_climb, significant_climbs


class SignificantClimbTests(unittest.TestCase):
    def test_collserola_major_climbs_are_significant(self) -> None:
        climbs = [
            {
                "id": "C001",
                "length_km": 9.5,
                "elevation_gain_m": 390,
                "avg_gradient_pct": 4.1,
                "max_1000_m_pct": 7.1,
            },
            {
                "id": "C002",
                "length_km": 9.47,
                "elevation_gain_m": 280,
                "avg_gradient_pct": 3.0,
                "max_1000_m_pct": 7.0,
            },
            {
                "id": "C003",
                "length_km": 1.95,
                "elevation_gain_m": 54,
                "avg_gradient_pct": 2.8,
                "max_1000_m_pct": 4.4,
            },
        ]

        significant = significant_climbs(climbs)
        self.assertEqual(len(significant), 2)
        self.assertEqual([climb["id"] for climb in significant], ["C001", "C002"])
        self.assertFalse(is_significant_climb(climbs[2]))


if __name__ == "__main__":
    unittest.main()
