"""Detour distance bands for POI ranking and display."""

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class DetourBand:
    """One off-route distance band with display metadata."""

    id: str
    label: str
    emoji: str
    tone: str
    min_m: float
    max_m: float | None


DETOUR_BANDS: Final[tuple[DetourBand, ...]] = (
    DetourBand("on_route", "On Route", "🟢", "good", 0.0, 20.0),
    DetourBand("very_small", "Very Small Detour", "🟢", "good", 20.0, 75.0),
    DetourBand("small", "Small Detour", "🟡", "caution", 75.0, 150.0),
    DetourBand("medium", "Medium Detour", "🟠", "warning", 150.0, 300.0),
    DetourBand("large", "Large Detour", "🔴", "bad", 300.0, None),
)


def classify_detour(distance_off_route_m: float) -> DetourBand:
    """Map an off-route distance in meters to a detour band."""
    distance = max(0.0, distance_off_route_m)

    for band in DETOUR_BANDS:
        if band.max_m is None:
            return band
        if band.min_m <= distance < band.max_m:
            return band

    return DETOUR_BANDS[-1]
