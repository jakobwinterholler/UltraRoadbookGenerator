"""Build Companion offline bundles from roadbook analysis."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from unsupported_sections import analyze_unsupported_sections

COMPANION_SCHEMA_VERSION = 2

POI_ICONS: dict[str, str] = {
    "water": "💧",
    "food": "🍽",
    "fuel": "⛽",
    "supermarket": "🛒",
    "convenience": "🏪",
    "restaurant": "🍴",
    "cafe": "☕",
    "bakery": "🥐",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _primary_poi(zone: dict[str, Any]) -> dict[str, Any] | None:
    categories = zone.get("categories") or []
    for key in ("water", "food", "fuel"):
        for group in categories:
            if group.get("key") == key and group.get("primary"):
                return group["primary"]
    for group in categories:
        if group.get("primary"):
            return group["primary"]
    return None


def _category_label(zone: dict[str, Any]) -> str:
    labels = [
        group.get("label", "")
        for group in (zone.get("categories") or [])
        if group.get("primary")
    ]
    return " · ".join(label for label in labels if label) or "Resupply"


def _format_poi_name(poi: dict[str, Any] | None, zone: dict[str, Any]) -> str:
    if not poi:
        return str(zone.get("name") or "Resupply")
    name = str(poi.get("name") or "").strip()
    brand = str(poi.get("brand") or "").strip()
    if name and brand and brand.lower() not in name.lower():
        return f"{brand} {name}".strip()
    return name or brand or str(zone.get("name") or "Resupply")


def _poi_icon(category: str) -> str:
    lowered = category.lower()
    for key, icon in POI_ICONS.items():
        if key in lowered:
            return icon
    return "📍"


def _verified_stop_key(zone_id: int | str) -> str:
    return str(zone_id)


def _build_bounds(track_points: list[dict[str, Any]]) -> dict[str, float]:
    if not track_points:
        return {"south": 0, "west": 0, "north": 0, "east": 0}
    lats = [float(point["lat"]) for point in track_points]
    lons = [float(point["lon"]) for point in track_points]
    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)
    lat_pad = max(0.01, (north - south) * 0.08)
    lon_pad = max(0.01, (east - west) * 0.08)
    return {
        "south": south - lat_pad,
        "north": north + lat_pad,
        "west": west - lon_pad,
        "east": east + lon_pad,
    }


def build_companion_bundle(
    race_id: str,
    roadbook: dict[str, Any],
    preparation: dict[str, Any],
    *,
    revision: int,
) -> dict[str, Any]:
    summary = roadbook.get("summary") or {}
    route = roadbook.get("route") or {}
    track_points = route.get("track_points") or []
    zones = roadbook.get("resupply_zones") or []
    verified_stops = (preparation or {}).get("verified_stops") or {}
    total_km = float(summary.get("distance_km") or 0)

    stops: list[dict[str, Any]] = []
    for zone in zones:
        zone_id = zone.get("zone_id")
        poi = _primary_poi(zone)
        category = str((poi or {}).get("poi_category") or "Resupply")
        record = verified_stops.get(_verified_stop_key(zone_id))
        verified = (record or {}).get("status") == "verified"
        notes = str((record or {}).get("reject_notes") or (record or {}).get("rejectNotes") or "").strip() or None
        stops.append(
            {
                "zoneId": zone_id,
                "km": zone.get("distance_along_km"),
                "lat": zone.get("lat"),
                "lon": zone.get("lon"),
                "name": _format_poi_name(poi, zone),
                "category": category,
                "categoryLabel": _category_label(zone),
                "icon": _poi_icon(category),
                "verificationStatus": "verified" if verified else "unverified",
                "openingHours": (poi or {}).get("opening_hours"),
                "notes": notes,
            }
        )

    stops.sort(key=lambda stop: float(stop.get("km") or 0))
    unsupported = analyze_unsupported_sections(zones, total_km)

    return {
        "schemaVersion": COMPANION_SCHEMA_VERSION,
        "revision": revision,
        "syncedAt": _utc_now(),
        "exportedAt": _utc_now(),
        "race": {
            "id": race_id,
            "name": summary.get("route_name") or "Untitled race",
            "distanceKm": total_km,
            "elevationGainM": float(summary.get("elevation_gain_m") or 0),
            "analyzedAt": roadbook.get("analyzed_at"),
        },
        "route": {
            "coordinates": [
                [float(point["lon"]), float(point["lat"])] for point in track_points
            ],
            "bounds": _build_bounds(track_points),
        },
        "stops": stops,
        "unsupportedSections": unsupported,
    }
