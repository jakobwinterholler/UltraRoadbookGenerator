"""Shared climb significance rules for analysis export and Companion bundles."""

from __future__ import annotations

from typing import Any, Protocol


class _ClimbMetrics(Protocol):
    length_km: float
    elevation_gain_m: float
    avg_gradient_pct: float


def _max_gradient_pct(climb: Any) -> float:
    values: list[float] = []
    for key in (
        "max_50_m_pct",
        "max_100_m_pct",
        "max_250_m_pct",
        "max_500_m_pct",
        "max_1000_m_pct",
    ):
        value = getattr(climb, key, None)
        if value is None and isinstance(climb, dict):
            value = climb.get(key)
        if value is not None:
            values.append(float(value))
    return max(values) if values else 0.0


def _length_km(climb: Any) -> float:
    if isinstance(climb, dict):
        return float(climb.get("length_km") or climb.get("lengthKm") or 0)
    return float(getattr(climb, "length_km", 0) or getattr(climb, "lengthKm", 0) or 0)


def _gain_m(climb: Any) -> float:
    if isinstance(climb, dict):
        return float(climb.get("elevation_gain_m") or climb.get("elevationGainM") or 0)
    return float(
        getattr(climb, "elevation_gain_m", 0) or getattr(climb, "elevationGainM", 0) or 0
    )


def _avg_gradient_pct(climb: Any) -> float:
    if isinstance(climb, dict):
        return float(climb.get("avg_gradient_pct") or climb.get("avgGradientPct") or 0)
    return float(
        getattr(climb, "avg_gradient_pct", 0) or getattr(climb, "avgGradientPct", 0) or 0
    )


def is_significant_climb(climb: Any) -> bool:
    """Return True when a climb is meaningful to riders, not a short GPX bump."""
    gain_m = _gain_m(climb)
    length_km = _length_km(climb)
    avg_gradient_pct = _avg_gradient_pct(climb)
    max_gradient_pct = _max_gradient_pct(climb)

    if gain_m < 100:
        return False
    if length_km < 2 and gain_m < 150:
        return False
    if gain_m >= 200:
        return True
    if length_km >= 5 and gain_m >= 150 and (
        avg_gradient_pct >= 2.5 or max_gradient_pct >= 6
    ):
        return True
    if length_km >= 3 and gain_m >= 120 and max_gradient_pct >= 5:
        return True
    return False


def significant_climbs(climbs: list[Any]) -> list[Any]:
    return [climb for climb in climbs if is_significant_climb(climb)]
