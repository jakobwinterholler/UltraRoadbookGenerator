"""Tests for fuel-station shop assessment."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from gas_station_shop import FuelShopConfidence, assess_fuel_shop  # noqa: E402


class GasStationShopTests(unittest.TestCase):
    def test_confirmed_from_shop_convenience(self) -> None:
        result = assess_fuel_shop(
            category="Gas station",
            tags={"amenity": "fuel", "shop": "convenience"},
        )
        assert result is not None
        self.assertEqual(result.confidence, FuelShopConfidence.CONFIRMED)
        self.assertEqual(result.label, "Shop confirmed")
        self.assertGreater(result.score_adjustment, 0)

    def test_unlikely_from_shop_no(self) -> None:
        result = assess_fuel_shop(
            category="Gas station",
            tags={"amenity": "fuel", "shop": "no", "brand": "Repsol"},
        )
        assert result is not None
        self.assertEqual(result.confidence, FuelShopConfidence.UNLIKELY)
        self.assertEqual(result.label, "Fuel only")

    def test_likely_from_major_brand(self) -> None:
        result = assess_fuel_shop(
            category="Gas station",
            tags={"amenity": "fuel", "brand": "Repsol"},
            name="Repsol",
        )
        assert result is not None
        self.assertEqual(result.confidence, FuelShopConfidence.LIKELY)
        self.assertEqual(result.label, "Shop likely")

    def test_unknown_without_signals(self) -> None:
        result = assess_fuel_shop(
            category="Gas station",
            tags={"amenity": "fuel", "name": "Area de Servei"},
            name="Area de Servei",
        )
        assert result is not None
        self.assertEqual(result.confidence, FuelShopConfidence.UNKNOWN)
        self.assertEqual(result.label, "Shop unknown")
        self.assertLess(result.score_adjustment, 0)

    def test_non_fuel_returns_none(self) -> None:
        self.assertIsNone(
            assess_fuel_shop(
                category="Mini supermarket",
                tags={"shop": "convenience"},
            )
        )


if __name__ == "__main__":
    unittest.main()
