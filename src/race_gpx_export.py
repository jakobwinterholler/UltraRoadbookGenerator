"""Export original race GPX with navigation waypoints — track geometry must never change."""

from __future__ import annotations

import hashlib
import re
import xml.sax.saxutils as saxutils
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from companion_bundle import (
    _category_label,
    _format_poi_name,
    _is_coffee_category,
    _poi_icon,
    _rank_zone_pois,
    _verified_stop_key,
    _zone_has_category,
)
from gpx_parser import load_gpx
from stop_confidence import compute_stop_confidence, is_high_confidence_stop

DEVICE_PROFILES = ("original", "coros", "garmin", "wahoo")
_CLOSING_TAG = re.compile(rb"</gpx\s*>", re.IGNORECASE)
_TRKPT_OPEN = re.compile(rb"<trkpt\s", re.IGNORECASE)


class GpxTrackModifiedError(ValueError):
    """Raised when export would alter the original route track."""


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


def _float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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


def fingerprint_gpx_bytes(gpx_bytes: bytes) -> TrackFingerprint:
    track_bytes = _extract_track_bytes(gpx_bytes)
    trkpt_count = len(_TRKPT_OPEN.findall(gpx_bytes))
    stats, _track = load_gpx_from_bytes(gpx_bytes)
    return TrackFingerprint(
        track_point_count=trkpt_count,
        distance_km=stats.distance_km,
        elevation_gain_m=stats.elevation_gain_m,
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
        (
            before.track_point_count == after.track_point_count,
            f"Track point count changed ({before.track_point_count} → {after.track_point_count}).",
        ),
        (
            abs(before.distance_km - after.distance_km) < 0.001,
            f"Route distance changed ({before.distance_km:.3f} → {after.distance_km:.3f} km).",
        ),
        (
            abs(before.elevation_gain_m - after.elevation_gain_m) < 0.5,
            "Elevation gain changed.",
        ),
        (
            before.geometry_checksum == after.geometry_checksum,
            "Route geometry checksum mismatch.",
        ),
        (
            before.track_bytes_checksum == after.track_bytes_checksum,
            "Track section bytes changed.",
        ),
    ]
    failures = [message for ok, message in checks if not ok]
    if failures:
        raise GpxTrackModifiedError(" ".join(failures))


def _short_brand_label(poi: dict[str, Any] | None, zone: dict[str, Any]) -> str:
    if not poi:
        return "Stop"
    brand = str(poi.get("brand") or "").strip()
    name = str(poi.get("name") or "").strip()
    if brand:
        return brand[:14]
    if name:
        return name[:14]
    return str(zone.get("name") or "Stop")[:14]


def _service_icons(zone: dict[str, Any], category: str) -> str:
    icons: list[str] = []
    if _zone_has_category(zone, "fuel"):
        icons.append("⛽")
    if _zone_has_category(zone, "water"):
        icons.append("💧")
    if _zone_has_category(zone, "food"):
        icons.append("🛒")
    if _is_coffee_category(category) or "cafe" in category.lower() or "café" in category.lower():
        icons.append("☕")
    if "restaurant" in category.lower() or "fast food" in category.lower():
        icons.append("🍽")
    if icons:
        return "".join(dict.fromkeys(icons))
    return _poi_icon(category)


def _format_km_label(km: float) -> str:
    rounded = int(round(km))
    return f"KM{rounded}"


def _waypoint_name(
    *,
    device_profile: str,
    zone: dict[str, Any],
    poi: dict[str, Any] | None,
    category: str,
    km: float,
    is_primary: bool,
) -> str:
    km_label = _format_km_label(km)
    icons = _service_icons(zone, category)
    short_label = _short_brand_label(poi, zone)

    if device_profile == "coros":
        prefix = "" if is_primary else "ALT "
        if "fuel" in category.lower() or _zone_has_category(zone, "fuel"):
            if _zone_has_category(zone, "water"):
                icons = "⛽💧"
            name = f"{prefix}{icons} {short_label} {km_label}".strip()
        elif "supermarket" in category.lower() or "convenience" in category.lower():
            name = f"{prefix}🛒 {short_label} {km_label}".strip()
        elif "water" in category.lower() or _zone_has_category(zone, "water"):
            name = f"{prefix}💧 {km_label}".strip()
        elif "cafe" in category.lower() or "café" in category.lower():
            name = f"{prefix}🍽 {short_label} {km_label}".strip()
        else:
            name = f"{prefix}{icons} {short_label} {km_label}".strip()
        return name[:32]

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
    if options.include_high_confidence:
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
        return True
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
            confidence = compute_stop_confidence(
                verification_status=verification_status,
                verified_at=(record or {}).get("updated_at") if isinstance(record, dict) else None,
                poi_score=_float_or_none(poi.get("score")),
                opening_hours=poi.get("opening_hours"),
                website=poi.get("website"),
                phone=poi.get("phone"),
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
                    ),
                    category=category,
                    km=km,
                    zone_id=zone_id,
                    is_primary=is_primary,
                    osm_key=osm_key,
                )
            )

    waypoints.sort(key=lambda item: (item.km, 0 if item.is_primary else 1))
    return waypoints


def _render_waypoints_xml(waypoints: list[GpsWaypoint]) -> str:
    if not waypoints:
        return ""
    chunks = ["\n  <!-- Ultra Roadbook navigation waypoints -->\n"]
    for waypoint in waypoints:
        lat = f"{waypoint.lat:.8f}".rstrip("0").rstrip(".")
        lon = f"{waypoint.lon:.8f}".rstrip("0").rstrip(".")
        chunks.append(f'  <wpt lat="{lat}" lon="{lon}">\n')
        if waypoint.ele is not None:
            ele = f"{waypoint.ele:.2f}".rstrip("0").rstrip(".")
            chunks.append(f"    <ele>{ele}</ele>\n")
        chunks.append(f"    <name>{saxutils.escape(waypoint.name)}</name>\n")
        chunks.append(f"    <desc>{saxutils.escape(waypoint.desc)}</desc>\n")
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
    waypoints = _collect_waypoints(roadbook, verified_stops, opts)
    waypoint_xml = _render_waypoints_xml(waypoints)
    output_bytes = _insert_waypoints(original_bytes, waypoint_xml)
    after = fingerprint_gpx_bytes(output_bytes)
    _validate_track_unchanged(before, after)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output_bytes)

    return {
        "device_profile": opts.device_profile,
        "waypoint_count": len(waypoints),
        "track_point_count": before.track_point_count,
        "distance_km": before.distance_km,
        "elevation_gain_m": before.elevation_gain_m,
        "geometry_checksum": before.geometry_checksum,
    }
