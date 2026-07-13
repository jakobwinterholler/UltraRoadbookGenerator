"""Simplified unsupported-section detection for Companion bundles."""

from __future__ import annotations

from typing import Any


def _zone_km(zone: dict[str, Any]) -> float:
    return float(zone.get("distance_along_km") or 0)


def analyze_unsupported_sections(
    zones: list[dict[str, Any]],
    total_km: float,
    *,
    min_gap_km: float = 10.0,
) -> list[dict[str, Any]]:
    if total_km <= 0:
        return []

    sorted_zones = sorted(zones, key=_zone_km)
    sections: list[dict[str, Any]] = []
    cursor = 0.0

    for zone in sorted_zones:
        km = _zone_km(zone)
        if km - cursor >= min_gap_km:
            sections.append(_make_section(cursor, km))
        cursor = max(cursor, km)

    if total_km - cursor >= min_gap_km:
        sections.append(_make_section(cursor, total_km))

    return sections


def _make_section(start_km: float, end_km: float) -> dict[str, Any]:
    distance = max(0.0, end_km - start_km)
    risk = "low"
    if distance >= 80:
        risk = "extreme"
    elif distance >= 60:
        risk = "critical"
    elif distance >= 40:
        risk = "high"
    elif distance >= 25:
        risk = "moderate"

    start_label = f"{start_km:.0f}"
    end_label = f"{end_km:.0f}"
    return {
        "id": f"unsupported-{start_label}-{end_label}",
        "startKm": round(start_km, 2),
        "endKm": round(end_km, 2),
        "distanceKm": round(distance, 2),
        "displayLabel": f"km {start_label}–{end_label} · {distance:.0f} km gap",
        "riskLevel": risk,
    }
