"""Export original race GPX with navigation waypoints — track geometry must never change.

Coros GPX export v3.0 — parity with shared/race/gpsGpxExport.ts and gpsGpxExportConstants.ts.
"""

from __future__ import annotations

import hashlib
import json
import re
import xml.sax.saxutils as saxutils
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from companion_bundle import (
    _category_label,
    _format_poi_name,
    _is_coffee_category,
    _rank_zone_pois,
    _verified_stop_key,
    _zone_has_category,
)
from gpx_parser import load_gpx
from resupply_intelligence import build_resupply_reason
from significant_climbs import significant_climbs
from stop_confidence import compute_stop_confidence, is_high_confidence_stop
from unsupported_sections import analyze_unsupported_sections

DEVICE_PROFILES = ("original", "coros", "garmin", "wahoo")
GPS_GPX_EXPORT_VERSION = "3.0"
INTEGRITY_FAILED_MSG = "Route integrity verification failed. Export cancelled."
MAX_WAYPOINT_OFF_ROUTE_M = 500.0
_COROS_WPT_ICONS = frozenset({"Water", "Supplies", "Hazard", "Bathroom", "Hut", "Campsite", "Trailfork", "Pin"})
_EXCLUDED_EXPORT_CATEGORY_KEYWORDS = (
    "climb",
    "summit",
    "unsupported",
    "analysis",
    "gap marker",
    "helper",
    "geometry",
)
_CLOSING_TAG = re.compile(rb"</gpx\s*>", re.IGNORECASE)
_TRKPT_OPEN = re.compile(rb"<trkpt\s", re.IGNORECASE)


class GpxTrackModifiedError(ValueError):
    """Raised when export would alter the original route track."""


class GpxExportQualityError(ValueError):
    """Raised when export waypoints fail pre-export quality checks."""


@dataclass(frozen=True)
class GpsGpxExportOptions:
    device_profile: str = "coros"
    verified_only: bool = True
    include_high_confidence: bool = False
    include_alternatives: bool = False


@dataclass(frozen=True)
class TrackFingerprint:
    track_point_count: int
    distance_km: float
    elevation_gain_m: float
    elevation_descent_m: float
    geometry_checksum: str
    track_bytes_checksum: str


@dataclass(frozen=True)
class GpsWaypoint:
    lat: float
    lon: float
    ele: float | None
    name: str
    desc: str
    category: str
    km: float
    zone_id: int | str
    is_primary: bool
    osm_key: str
    sym: str | None
    verification_status: str
    off_route_m: float | None


def _float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_invalid_export_name(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return True
    lowered = normalized.lower()
    if lowered in {"unnamed", "stop", "resupply", "resupply stop"}:
        return True
    if re.match(r"^checkpoint\s*\d+\.?$", lowered):
        return True
    if re.match(r"^(fuel\s*)?station\s*\d+\.?$", lowered):
        return True
    if re.match(r"^stop\s*\d+\.?$", lowered):
        return True
    if lowered.startswith("carretera"):
        return True
    return False


def _is_excluded_export_category(category: str) -> bool:
    lowered = category.lower()
    return any(keyword in lowered for keyword in _EXCLUDED_EXPORT_CATEGORY_KEYWORDS)


def _resolve_coros_wpt_sym(*, category: str, zone: dict[str, Any]) -> str:
    cat = category.lower()
    if _zone_has_category(zone, "water") or any(token in cat for token in ("water", "drinking", "fountain")):
        return "Water"
    if _zone_has_category(zone, "fuel") or "fuel" in cat or "gas station" in cat or "gas_station" in cat:
        return "Supplies"
    if _zone_has_category(zone, "food") or any(
        token in cat
        for token in (
            "supermarket",
            "convenience",
            "mini supermarket",
            "small supermarket",
            "cafe",
            "café",
            "coffee",
            "restaurant",
            "fast food",
            "bakery",
            "shop",
        )
    ):
        return "Supplies"
    if "hazard" in cat or "danger" in cat:
        return "Hazard"
    if any(token in cat for token in ("toilet", "restroom", "bathroom")):
        return "Bathroom"
    if any(token in cat for token in ("shelter", "hut", "refuge")):
        return "Hut"
    if "camp" in cat:
        return "Campsite"
    if any(token in cat for token in ("crossroad", "cross road", "junction", "trail fork")):
        return "Trailfork"
    if "bike" in cat and "shop" in cat:
        return "Supplies"
    return "Pin"


def _coros_waypoint_emoji(*, category: str, zone: dict[str, Any]) -> str:
    sym = _resolve_coros_wpt_sym(category=category, zone=zone)
    mapping = {
        "Water": "💧",
        "Supplies": "⛽" if _zone_has_category(zone, "fuel") else ("🛒" if _zone_has_category(zone, "food") else "📦"),
        "Hazard": "⚠️",
        "Bathroom": "🚻",
        "Hut": "🏠",
        "Campsite": "⛺",
        "Trailfork": "🔀",
        "Pin": "📍",
    }
    return mapping.get(sym, "📍")


def _format_coros_waypoint_name(
    *,
    zone: dict[str, Any],
    poi: dict[str, Any] | None,
    category: str,
    km: float,
    is_primary: bool,
    resupply_reason: str | None = None,
) -> str:
    prefix = "" if is_primary else "ALT "
    emoji = _coros_waypoint_emoji(category=category, zone=zone)
    label = _smart_poi_label(poi, zone, category)
    reason = str(resupply_reason or "").lower()
    if label == "Fuel" and "last" in reason:
        return f"{prefix}{emoji} Last fuel".strip()[:32]
    if label == "Water":
        return f"{prefix}{emoji} Water km {round(km)}".strip()[:32]
    return f"{prefix}{emoji} {label}".strip()[:32]


def _category_fallback_label(category: str, zone: dict[str, Any]) -> str:
    if _zone_has_category(zone, "fuel"):
        return "Fuel"
    if _zone_has_category(zone, "water"):
        return "Water"
    if _zone_has_category(zone, "food"):
        return "Shop"
    cat = category.lower()
    if "supermarket" in cat:
        return "Supermarket"
    if "convenience" in cat:
        return "Shop"
    if "cafe" in cat or "café" in cat:
        return "Café"
    if "restaurant" in cat:
        return "Restaurant"
    if "water" in cat or "fountain" in cat:
        return "Water"
    zone_name = str(zone.get("name") or "").strip()
    if zone_name and not _is_invalid_export_name(zone_name):
        return zone_name[:14]
    return "Stop"


def _smart_poi_label(
    poi: dict[str, Any] | None,
    zone: dict[str, Any],
    category: str,
) -> str:
    brand = str((poi or {}).get("brand") or "").strip()
    name = str((poi or {}).get("name") or "").strip()
    if brand and not _is_invalid_export_name(brand):
        return brand[:14]
    if name and not _is_invalid_export_name(name):
        return name[:14]
    return _category_fallback_label(category, zone)[:14]


def _geometry_checksum_from_bytes(gpx_bytes: bytes) -> str:
    parts: list[str] = []
    for match in re.finditer(
        rb"<trkpt\s+lat=\"([^\"]+)\"\s+lon=\"([^\"]+)\"[^>]*>(.*?)</trkpt>",
        gpx_bytes,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        lat = match.group(1).decode("utf-8", errors="replace")
        lon = match.group(2).decode("utf-8", errors="replace")
        body = match.group(3)
        ele_match = re.search(rb"<ele[^>]*>([^<]+)</ele>", body, flags=re.IGNORECASE)
        ele = ele_match.group(1).decode("utf-8", errors="replace").strip() if ele_match else ""
        parts.append(f"{lat},{lon},{ele}")
    if not parts:
        raise ValueError("No track points found in GPX.")
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return digest


def _extract_track_bytes(gpx_bytes: bytes) -> bytes:
    chunks: list[bytes] = []
    for match in re.finditer(rb"<trk\b[^>]*>.*?</trk>", gpx_bytes, flags=re.IGNORECASE | re.DOTALL):
        chunks.append(match.group(0))
    if not chunks:
        raise ValueError("No <trk> sections found in GPX.")
    return b"".join(chunks)


def _compute_elevation_descent_m(points: list[tuple[float, float, float | None]]) -> float:
    descent = 0.0
    for index in range(1, len(points)):
        previous_ele = points[index - 1][2]
        current_ele = points[index][2]
        if previous_ele is None or current_ele is None:
            continue
        diff = previous_ele - current_ele
        if diff > 0:
            descent += diff
    return descent


def _parse_track_points_from_bytes(gpx_bytes: bytes) -> list[tuple[float, float, float | None]]:
    points: list[tuple[float, float, float | None]] = []
    for match in re.finditer(
        rb"<trkpt\s+lat=\"([^\"]+)\"\s+lon=\"([^\"]+)\"[^>]*>(.*?)</trkpt>",
        gpx_bytes,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        lat = float(match.group(1))
        lon = float(match.group(2))
        body = match.group(3)
        ele_match = re.search(rb"<ele[^>]*>([^<]+)</ele>", body, flags=re.IGNORECASE)
        ele = float(ele_match.group(1)) if ele_match else None
        points.append((lat, lon, ele))
    if not points:
        raise ValueError("No track points found in GPX.")
    return points


def fingerprint_gpx_bytes(gpx_bytes: bytes) -> TrackFingerprint:
    track_bytes = _extract_track_bytes(gpx_bytes)
    trkpt_count = len(_TRKPT_OPEN.findall(gpx_bytes))
    stats, _track = load_gpx_from_bytes(gpx_bytes)
    raw_points = _parse_track_points_from_bytes(gpx_bytes)
    return TrackFingerprint(
        track_point_count=trkpt_count,
        distance_km=stats.distance_km,
        elevation_gain_m=stats.elevation_gain_m,
        elevation_descent_m=_compute_elevation_descent_m(raw_points),
        geometry_checksum=_geometry_checksum_from_bytes(gpx_bytes),
        track_bytes_checksum=hashlib.sha256(track_bytes).hexdigest(),
    )


def load_gpx_from_bytes(gpx_bytes: bytes):
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".gpx", delete=False) as handle:
        handle.write(gpx_bytes)
        temp_path = Path(handle.name)
    try:
        return load_gpx(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)


def _validate_track_unchanged(before: TrackFingerprint, after: TrackFingerprint) -> None:
    checks = [
        before.track_point_count == after.track_point_count,
        before.distance_km == after.distance_km,
        before.elevation_gain_m == after.elevation_gain_m,
        before.elevation_descent_m == after.elevation_descent_m,
        before.geometry_checksum == after.geometry_checksum,
        before.track_bytes_checksum == after.track_bytes_checksum,
    ]
    if not all(checks):
        raise GpxTrackModifiedError(INTEGRITY_FAILED_MSG)


def _format_km_label(km: float) -> str:
    return f"KM{int(round(km))}"


def _waypoint_name(
    *,
    device_profile: str,
    zone: dict[str, Any],
    poi: dict[str, Any] | None,
    category: str,
    km: float,
    is_primary: bool,
    resupply_reason: str | None = None,
) -> str:
    if device_profile == "coros":
        return _format_coros_waypoint_name(
            zone=zone,
            poi=poi,
            category=category,
            km=km,
            is_primary=is_primary,
            resupply_reason=resupply_reason,
        )

    km_label = _format_km_label(km)
    full_name = _format_poi_name(poi, zone)
    if not is_primary:
        return f"ALT {full_name} {km_label}"[:64]
    return f"{full_name} {km_label}"[:64]


def _service_labels(zone: dict[str, Any], category: str) -> str:
    services: list[str] = []
    if _zone_has_category(zone, "fuel"):
        services.append("Fuel")
    if _zone_has_category(zone, "water"):
        services.append("Water")
    if _zone_has_category(zone, "food"):
        services.append("Food")
    if _is_coffee_category(category):
        services.append("Coffee")
    if not services:
        services.append(category)
    return ", ".join(services)


def _waypoint_desc(
    *,
    zone: dict[str, Any],
    poi: dict[str, Any] | None,
    category: str,
    category_label: str,
    km: float,
    verification_status: str,
    confidence: dict[str, Any],
    is_primary: bool,
    sym: str | None,
) -> str:
    lines = [
        f"Type: {category_label or category}",
        f"Services: {_service_labels(zone, category)}",
        f"Route km: {km:.2f}",
        f"Opening hours: {(poi or {}).get('opening_hours') or 'Unknown'}",
        f"Confidence: {confidence['label']} ({confidence['score']})",
        f"Role: {'Primary' if is_primary else 'Alternative'}",
        f"Verification: {verification_status}",
    ]
    if sym:
        lines.append(f"Coros icon: {sym}")
    return "\n".join(lines)


def _verification_status(record: dict[str, Any] | None) -> str:
    if not record:
        return "unverified"
    status = record.get("status")
    if status == "verified":
        return "verified"
    if status in ("rejected", "deferred"):
        return "needs_review"
    return "unverified"


def _count_verified_zones(
    roadbook: dict[str, Any],
    verified_stops: dict[str, Any],
) -> int:
    count = 0
    for zone in roadbook.get("resupply_zones") or []:
        if not isinstance(zone, dict):
            continue
        zone_id = zone.get("zone_id")
        record = verified_stops.get(_verified_stop_key(zone_id))
        if _verification_status(record if isinstance(record, dict) else None) == "verified":
            count += 1
    return count


def _zone_should_export(
    zone: dict[str, Any],
    verified_stops: dict[str, Any],
    options: GpsGpxExportOptions,
) -> bool:
    zone_id = zone.get("zone_id")
    record = verified_stops.get(_verified_stop_key(zone_id))
    status = _verification_status(record if isinstance(record, dict) else None)
    if status == "verified":
        return True
    if options.include_high_confidence and options.device_profile != "coros":
        ranked = _rank_zone_pois(zone)
        poi = ranked[0][0] if ranked else None
        return is_high_confidence_stop(
            verification_status=status,
            verified_at=(record or {}).get("updated_at") if isinstance(record, dict) else None,
            poi_score=_float_or_none((poi or {}).get("score")),
            opening_hours=(poi or {}).get("opening_hours"),
            website=(poi or {}).get("website"),
            phone=(poi or {}).get("phone"),
        )
    if not options.verified_only:
        return options.device_profile != "coros"
    return False


def _collect_waypoints(
    roadbook: dict[str, Any],
    verified_stops: dict[str, Any],
    options: GpsGpxExportOptions,
) -> list[GpsWaypoint]:
    zones = roadbook.get("resupply_zones") or []
    waypoints: list[GpsWaypoint] = []
    seen_osm: set[str] = set()
    seen_zone_primary: set[str] = set()
    total_km = float((roadbook.get("summary") or {}).get("distance_km") or 0)
    climbs = significant_climbs(roadbook.get("climbs") or [])
    unsupported = analyze_unsupported_sections(zones, total_km)

    for zone in zones:
        if not isinstance(zone, dict):
            continue
        if not _zone_should_export(zone, verified_stops, options):
            continue

        zone_id = zone.get("zone_id")
        record = verified_stops.get(_verified_stop_key(zone_id))
        verification_status = _verification_status(record if isinstance(record, dict) else None)
        ranked = _rank_zone_pois(zone)
        if not ranked:
            continue

        entries: list[tuple[dict[str, Any], str, str, bool]] = []
        primary_poi, primary_key, primary_label = ranked[0]
        entries.append((primary_poi, primary_key, primary_label, True))
        if options.include_alternatives:
            for alt_poi, alt_key, alt_label in ranked[1:]:
                entries.append((alt_poi, alt_key, alt_label, False))

        for poi, _category_key, category_label, is_primary in entries:
            osm_type = str(poi.get("osm_type") or "")
            osm_id = str(poi.get("osm_id") or "")
            osm_key = f"{osm_type}-{osm_id}"
            if not osm_id or osm_key in seen_osm:
                continue
            if is_primary:
                zone_key = str(zone_id)
                if zone_key in seen_zone_primary:
                    continue
                seen_zone_primary.add(zone_key)
            seen_osm.add(osm_key)

            category = str(poi.get("poi_category") or category_label or "Resupply")
            km = float(poi.get("distance_along_km") or zone.get("distance_along_km") or 0)
            lat = float(poi.get("lat") if poi.get("lat") is not None else zone.get("lat") or 0)
            lon = float(poi.get("lon") if poi.get("lon") is not None else zone.get("lon") or 0)
            off_route_m = _float_or_none(poi.get("distance_off_route_m"))
            sym = (
                _resolve_coros_wpt_sym(category=category, zone=zone)
                if options.device_profile == "coros"
                else None
            )
            confidence = compute_stop_confidence(
                verification_status=verification_status,
                verified_at=(record or {}).get("updated_at") if isinstance(record, dict) else None,
                poi_score=_float_or_none(poi.get("score")),
                opening_hours=poi.get("opening_hours"),
                website=poi.get("website"),
                phone=poi.get("phone"),
            )
            resupply_reason = (
                build_resupply_reason(
                    poi,
                    category_key=_category_key,
                    zone_km=float(zone.get("distance_along_km") or 0),
                    climbs=climbs,
                    unsupported_sections=unsupported,
                    peer_pois=[entry[0] for entry in ranked],
                )
                if is_primary
                else None
            )
            waypoints.append(
                GpsWaypoint(
                    lat=lat,
                    lon=lon,
                    ele=_float_or_none(poi.get("elevation_m")),
                    name=_waypoint_name(
                        device_profile=options.device_profile,
                        zone=zone,
                        poi=poi,
                        category=category,
                        km=km,
                        is_primary=is_primary,
                        resupply_reason=resupply_reason,
                    ),
                    desc=_waypoint_desc(
                        zone=zone,
                        poi=poi,
                        category=category,
                        category_label=category_label,
                        km=km,
                        verification_status=verification_status,
                        confidence=confidence,
                        is_primary=is_primary,
                        sym=sym,
                    ),
                    category=category,
                    km=km,
                    zone_id=zone_id,
                    is_primary=is_primary,
                    osm_key=osm_key,
                    sym=sym,
                    verification_status=verification_status,
                    off_route_m=off_route_m,
                )
            )

    waypoints.sort(key=lambda item: (item.km, 0 if item.is_primary else 1))
    return waypoints


def _validate_export_quality(
    waypoints: list[GpsWaypoint],
    *,
    device_profile: str,
    verified_poi_count: int,
) -> None:
    failures: list[str] = []
    seen_names: set[tuple[str, float, float]] = set()

    for waypoint in waypoints:
        if waypoint.verification_status != "verified":
            failures.append(f"Waypoint '{waypoint.name}' is not verified.")
        if _is_excluded_export_category(waypoint.category):
            failures.append(f"Unsupported marker category: {waypoint.category}.")
        if _is_invalid_export_name(waypoint.name.replace("ALT ", "").strip()):
            failures.append(f"Invalid waypoint name: {waypoint.name}.")
        if device_profile == "coros":
            if not waypoint.sym or waypoint.sym not in _COROS_WPT_ICONS:
                failures.append(f"Missing Coros icon for '{waypoint.name}'.")
        if waypoint.off_route_m is not None and waypoint.off_route_m > MAX_WAYPOINT_OFF_ROUTE_M:
            failures.append(
                f"Waypoint '{waypoint.name}' is too far from route ({waypoint.off_route_m:.0f} m)."
            )
        dedupe_key = (waypoint.name, round(waypoint.lat, 5), round(waypoint.lon, 5))
        if dedupe_key in seen_names:
            failures.append(f"Duplicate waypoint: {waypoint.name}.")
        seen_names.add(dedupe_key)

    if verified_poi_count < len(waypoints):
        failures.append("Exported POI count exceeds verified POI count.")

    if failures:
        raise GpxExportQualityError(" ".join(failures))


def _render_waypoints_xml(waypoints: list[GpsWaypoint], *, device_profile: str) -> str:
    if not waypoints:
        return ""
    chunks = [f"\n  <!-- Ultra Roadbook navigation waypoints v{GPS_GPX_EXPORT_VERSION} -->\n"]
    for waypoint in waypoints:
        lat = f"{waypoint.lat:.8f}".rstrip("0").rstrip(".")
        lon = f"{waypoint.lon:.8f}".rstrip("0").rstrip(".")
        chunks.append(f'  <wpt lat="{lat}" lon="{lon}">\n')
        if waypoint.ele is not None:
            ele = f"{waypoint.ele:.2f}".rstrip("0").rstrip(".")
            chunks.append(f"    <ele>{ele}</ele>\n")
        chunks.append(f"    <name>{saxutils.escape(waypoint.name)}</name>\n")
        chunks.append(f"    <desc>{saxutils.escape(waypoint.desc)}</desc>\n")
        if device_profile == "coros" and waypoint.sym:
            chunks.append(f"    <sym>{saxutils.escape(waypoint.sym)}</sym>\n")
            chunks.append(f"    <type>{saxutils.escape(waypoint.sym)}</type>\n")
        else:
            chunks.append(f"    <type>{saxutils.escape(waypoint.category)}</type>\n")
        chunks.append("  </wpt>\n")
    return "".join(chunks)


def _insert_waypoints(original: bytes, waypoint_xml: str) -> bytes:
    if not waypoint_xml:
        return original
    match = _CLOSING_TAG.search(original)
    if not match:
        raise ValueError("Invalid GPX: missing </gpx> closing tag.")
    insert_at = match.start()
    encoded = waypoint_xml.encode("utf-8")
    return original[:insert_at] + encoded + original[insert_at:]


def build_gps_gpx_export_report(
    *,
    before: TrackFingerprint,
    waypoints: list[GpsWaypoint],
    verified_poi_count: int,
    device_profile: str,
    route_integrity_passed: bool,
) -> dict[str, Any]:
    coros_icons_assigned = sum(1 for waypoint in waypoints if waypoint.sym)
    exported_count = len(waypoints)
    return {
        "export_version": GPS_GPX_EXPORT_VERSION,
        "device_profile": device_profile,
        "route_integrity_passed": route_integrity_passed,
        "track_point_count": before.track_point_count,
        "distance_km": round(before.distance_km, 2),
        "elevation_gain_m": round(before.elevation_gain_m),
        "elevation_descent_m": round(before.elevation_descent_m),
        "verified_poi_count": verified_poi_count,
        "exported_poi_count": exported_count,
        "coros_icons_assigned": coros_icons_assigned if device_profile == "coros" else None,
        "coros_icons_total": exported_count if device_profile == "coros" else None,
        "integrity_percent": 100 if route_integrity_passed else 0,
        "waypoint_count": exported_count,
        "geometry_checksum": before.geometry_checksum,
    }


def export_race_gpx_for_gps(
    *,
    original_gpx_path: Path,
    roadbook: dict[str, Any],
    verified_stops: dict[str, Any],
    output_path: Path,
    options: GpsGpxExportOptions | None = None,
) -> dict[str, Any]:
    """Write GPX with original track preserved and optional navigation waypoints."""
    opts = options or GpsGpxExportOptions()
    if opts.device_profile not in DEVICE_PROFILES:
        raise ValueError(f"Unsupported device profile: {opts.device_profile}")

    original_bytes = original_gpx_path.read_bytes()
    before = fingerprint_gpx_bytes(original_bytes)
    verified_poi_count = _count_verified_zones(roadbook, verified_stops)
    waypoints = _collect_waypoints(roadbook, verified_stops, opts)
    _validate_export_quality(
        waypoints,
        device_profile=opts.device_profile,
        verified_poi_count=verified_poi_count,
    )
    waypoint_xml = _render_waypoints_xml(waypoints, device_profile=opts.device_profile)
    output_bytes = _insert_waypoints(original_bytes, waypoint_xml)
    after = fingerprint_gpx_bytes(output_bytes)
    _validate_track_unchanged(before, after)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output_bytes)

    return build_gps_gpx_export_report(
        before=before,
        waypoints=waypoints,
        verified_poi_count=verified_poi_count,
        device_profile=opts.device_profile,
        route_integrity_passed=True,
    )


def export_report_json(report: dict[str, Any]) -> str:
    return json.dumps(report, separators=(",", ":"))
