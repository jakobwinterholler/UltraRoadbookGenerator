"""Build Companion offline bundles from roadbook analysis."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from race_dashboard import compute_race_dashboard_stats
from unsupported_sections import analyze_unsupported_sections

COMPANION_SCHEMA_VERSION = 4

POI_ICONS: dict[str, str] = {
    "water": "💧",
    "food": "🍽",
    "fuel": "⛽",
    "supermarket": "🛒",
    "convenience": "🏪",
    "restaurant": "🍽",
    "cafe": "☕",
    "café": "☕",
    "bakery": "🥐",
}

DEFAULT_RIDER_ASSUMPTIONS = {
    "ridingSpeedKmh": 20,
    "climbingPenaltyMinPer100m": 3,
    "waterMlPerHour": 500,
    "carbsGPerHour": 60,
    "maxGapWithoutResupplyKm": 45,
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _zone_has_category(zone: dict[str, Any], key: str) -> bool:
    for group in zone.get("categories") or []:
        if group.get("key") == key and group.get("primary"):
            return True
    return False


def _is_coffee_category(category: str) -> bool:
    lowered = category.lower()
    return "cafe" in lowered or "coffee" in lowered or lowered == "café"


def _primary_poi(zone: dict[str, Any]) -> dict[str, Any] | None:
    for key in ("water", "food", "fuel"):
        for group in zone.get("categories") or []:
            if group.get("key") == key and group.get("primary"):
                return group["primary"]
    for group in zone.get("categories") or []:
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
    if "supermarket" in lowered:
        return "🛒"
    if "convenience" in lowered:
        return "🏪"
    if "cafe" in lowered or "café" in lowered or "coffee" in lowered:
        return "☕"
    if "restaurant" in lowered:
        return "🍽"
    if "water" in lowered or "drinking" in lowered:
        return "💧"
    if "fuel" in lowered or "gas" in lowered:
        return "⛽"
    for key, icon in POI_ICONS.items():
        if key in lowered:
            return icon
    return "📍"


def _is_google_place_id(value: str) -> bool:
    value = value.strip()
    return len(value) >= 10 and value.startswith(("ChI", "GhI", "EhI"))


def _poi_place_id(poi: dict[str, Any] | None) -> str | None:
    if not poi:
        return None
    direct = poi.get("place_id") or poi.get("placeId")
    if isinstance(direct, str) and _is_google_place_id(direct):
        return direct.strip()
    tags = poi.get("tags") or {}
    if isinstance(tags, dict):
        for key in ("place_id", "google_place_id", "google:place_id"):
            value = tags.get(key)
            if isinstance(value, str) and _is_google_place_id(value):
                return value.strip()
    return None


def _climb_name(climb: dict[str, Any], index: int) -> str:
    for key in ("nickname", "suggested_name"):
        value = climb.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    climb_id = str(climb.get("id") or "").strip()
    if climb_id:
        return f"Climb {climb_id.replace('C', '')}"
    return f"Climb {index + 1}"


def _build_climbs(roadbook: dict[str, Any]) -> list[dict[str, Any]]:
    climbs: list[dict[str, Any]] = []
    for index, climb in enumerate(roadbook.get("climbs") or []):
        if not isinstance(climb, dict):
            continue
        climbs.append(
            {
                "id": str(climb.get("id") or f"climb-{index + 1}"),
                "name": _climb_name(climb, index),
                "startKm": climb.get("start_km"),
                "endKm": climb.get("end_km"),
                "lengthKm": climb.get("length_km"),
                "elevationGainM": climb.get("elevation_gain_m"),
                "avgGradientPct": climb.get("avg_gradient_pct"),
                "max50mPct": climb.get("max_50_m_pct"),
                "max100mPct": climb.get("max_100_m_pct"),
                "max250mPct": climb.get("max_250_m_pct"),
                "max500mPct": climb.get("max_500_m_pct"),
                "max1000mPct": climb.get("max_1000_m_pct"),
            }
        )
    return climbs


def _verified_stop_key(zone_id: int | str) -> str:
    return str(zone_id)


def _verification_status(record: dict[str, Any] | None) -> str:
    if not record:
        return "unverified"
    status = record.get("status")
    if status == "verified":
        return "verified"
    if status in ("rejected", "deferred"):
        return "needs_review"
    return "unverified"


def _elevation_gain_in_range(track_points: list[dict[str, Any]], start_km: float, end_km: float) -> int:
    in_range = [
        point
        for point in track_points
        if start_km <= float(point.get("km") or 0) <= end_km
    ]
    if len(in_range) < 2:
        return int(max(0, (end_km - start_km) * 8))
    gain = 0.0
    for index in range(1, len(in_range)):
        previous = in_range[index - 1].get("ele_m")
        current = in_range[index].get("ele_m")
        if previous is not None and current is not None and current > previous:
            gain += float(current) - float(previous)
    return int(round(gain))


def _estimate_riding_hours(distance_km: float, elevation_gain_m: float, assumptions: dict[str, float]) -> float:
    base = distance_km / assumptions["ridingSpeedKmh"]
    climb = (elevation_gain_m / 100) * (assumptions["climbingPenaltyMinPer100m"] / 60)
    return base + climb


def _unsupported_risk_band(distance_km: float, elevation_gain_m: float, assumptions: dict[str, float]) -> str:
    gap_factor = distance_km / assumptions["maxGapWithoutResupplyKm"]
    climb_factor = elevation_gain_m / 1500
    score = gap_factor * 0.7 + climb_factor * 0.3
    if score >= 1.4:
        return "High"
    if score >= 0.85:
        return "Medium"
    return "Low"


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
    rider_assumptions: dict[str, float] | None = None,
) -> dict[str, Any]:
    summary = roadbook.get("summary") or {}
    route = roadbook.get("route") or {}
    track_points = route.get("track_points") or []
    zones = roadbook.get("resupply_zones") or []
    verified_stops = (preparation or {}).get("verified_stops") or {}
    total_km = float(summary.get("distance_km") or 0)
    assumptions = {**DEFAULT_RIDER_ASSUMPTIONS, **(rider_assumptions or {})}

    stops: list[dict[str, Any]] = []
    for zone in zones:
        zone_id = zone.get("zone_id")
        poi = _primary_poi(zone)
        category = str((poi or {}).get("poi_category") or "Resupply")
        poi_lat = (poi or {}).get("lat")
        poi_lon = (poi or {}).get("lon")
        stop_lat = float(poi_lat if poi_lat is not None else zone.get("lat") or 0)
        stop_lon = float(poi_lon if poi_lon is not None else zone.get("lon") or 0)
        record = verified_stops.get(_verified_stop_key(zone_id))
        status = _verification_status(record if isinstance(record, dict) else None)
        notes = str((record or {}).get("reject_notes") or (record or {}).get("rejectNotes") or "").strip() or None
        stops.append(
            {
                "zoneId": zone_id,
                "km": zone.get("distance_along_km"),
                "lat": stop_lat,
                "lon": stop_lon,
                "name": _format_poi_name(poi, zone),
                "category": category,
                "categoryLabel": _category_label(zone),
                "icon": _poi_icon(category),
                "verificationStatus": status,
                "openingHours": (poi or {}).get("opening_hours"),
                "notes": notes,
                "phone": (poi or {}).get("phone"),
                "website": (poi or {}).get("website"),
                "hasFood": _zone_has_category(zone, "food"),
                "hasWater": _zone_has_category(zone, "water"),
                "hasFuel": _zone_has_category(zone, "fuel"),
                "hasCoffee": _is_coffee_category(category),
                "confidenceScore": (poi or {}).get("score"),
                "verificationDate": (record or {}).get("updated_at") if status == "verified" else None,
                "placeId": _poi_place_id(poi),
            }
        )

    stops.sort(key=lambda stop: float(stop.get("km") or 0))
    raw_sections = analyze_unsupported_sections(zones, total_km)
    unsupported: list[dict[str, Any]] = []
    for section in raw_sections:
        start_km = float(section["startKm"])
        end_km = float(section["endKm"])
        distance = float(section["distanceKm"])
        elevation_gain = _elevation_gain_in_range(track_points, start_km, end_km)
        riding_hours = _estimate_riding_hours(distance, elevation_gain, assumptions)
        unsupported.append(
            {
                **section,
                "elevationGainM": elevation_gain,
                "estimatedRidingHours": round(riding_hours, 2),
                "waterNeededMl": int(round(riding_hours * assumptions["waterMlPerHour"])),
                "carbsNeededG": int(round(riding_hours * assumptions["carbsGPerHour"])),
                "riskBand": _unsupported_risk_band(distance, elevation_gain, assumptions),
            }
        )

    dashboard = compute_race_dashboard_stats(roadbook, preparation, max_gap_km=assumptions["maxGapWithoutResupplyKm"])
    dashboard_stats = {
        "verifiedStops": dashboard["verified_stops"],
        "unverifiedStops": dashboard["unverified_stops"],
        "remainingStops": dashboard["unverified_stops"],
        "remainingUnsupportedKm": int(
            round(
                sum(
                    section["distanceKm"]
                    for section in unsupported
                    if section["distanceKm"] >= assumptions["maxGapWithoutResupplyKm"] * 0.5
                )
            )
        ),
        "readinessScore": dashboard["readiness_score"],
        "readinessReasons": dashboard["readiness_reasons"],
    }

    elevation_samples = [
        float(point["ele_m"]) if point.get("ele_m") is not None else None
        for point in track_points
    ]
    route_payload: dict[str, Any] = {
        "coordinates": [
            [float(point["lon"]), float(point["lat"])] for point in track_points
        ],
        "bounds": _build_bounds(track_points),
    }
    if any(value is not None for value in elevation_samples):
        route_payload["elevationsM"] = [
            value if value is not None else 0.0 for value in elevation_samples
        ]

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
        "route": route_payload,
        "stops": stops,
        "climbs": _build_climbs(roadbook),
        "unsupportedSections": unsupported,
        "dashboardStats": dashboard_stats,
        "riderAssumptions": assumptions,
    }
