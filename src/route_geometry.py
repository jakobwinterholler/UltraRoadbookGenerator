"""Geometry helpers for locating points relative to a GPX route."""

import math
from dataclasses import dataclass

from gpx_parser import TrackPoint

_METERS_PER_DEG_LAT = 110_540.0


def _meters_per_deg_lon(lat_deg: float) -> float:
    return 111_320.0 * math.cos(math.radians(lat_deg))


@dataclass(frozen=True)
class RouteProjection:
    """Result of projecting a point onto the nearest route segment."""

    distance_along_km: float
    distance_off_route_m: float


def track_bounding_box(
    track: list[TrackPoint],
    buffer_m: float,
) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) in degrees with buffer applied."""
    lats = [point.lat for point in track]
    lons = [point.lon for point in track]

    south, north = min(lats), max(lats)
    west, east = min(lons), max(lons)

    mean_lat = (south + north) / 2.0
    buffer_lat = buffer_m / _METERS_PER_DEG_LAT
    buffer_lon = buffer_m / _meters_per_deg_lon(mean_lat)

    return (south - buffer_lat, west - buffer_lon, north + buffer_lat, east + buffer_lon)


def _segment_bounding_box(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
) -> tuple[float, float, float, float]:
    return min(start_lat, end_lat), min(start_lon, end_lon), max(start_lat, end_lat), max(start_lon, end_lon)


def _point_near_bbox(
    lat: float,
    lon: float,
    south: float,
    west: float,
    north: float,
    east: float,
    margin_m: float,
) -> bool:
    mean_lat = (lat + south + north) / 3.0
    margin_lat = margin_m / _METERS_PER_DEG_LAT
    margin_lon = margin_m / _meters_per_deg_lon(mean_lat)
    return (south - margin_lat) <= lat <= (north + margin_lat) and (west - margin_lon) <= lon <= (
        east + margin_lon
    )


def _point_segment_projection(
    point_lat: float,
    point_lon: float,
    seg_start_lat: float,
    seg_start_lon: float,
    seg_end_lat: float,
    seg_end_lon: float,
) -> tuple[float, float]:
    """Return perpendicular distance in meters and fraction along the segment."""
    mean_lat = (point_lat + seg_start_lat + seg_end_lat) / 3.0
    meters_lon = _meters_per_deg_lon(mean_lat)

    px = point_lon * meters_lon
    py = point_lat * _METERS_PER_DEG_LAT
    x1 = seg_start_lon * meters_lon
    y1 = seg_start_lat * _METERS_PER_DEG_LAT
    x2 = seg_end_lon * meters_lon
    y2 = seg_end_lat * _METERS_PER_DEG_LAT

    dx = x2 - x1
    dy = y2 - y1
    segment_length_sq = dx * dx + dy * dy

    if segment_length_sq == 0.0:
        return math.hypot(px - x1, py - y1), 0.0

    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / segment_length_sq))
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    return math.hypot(px - closest_x, py - closest_y), t


def project_point_to_route(
    track: list[TrackPoint],
    lat: float,
    lon: float,
    *,
    search_radius_m: float | None = None,
) -> RouteProjection | None:
    """Project a lat/lon point onto the nearest GPX track segment."""
    if not track:
        return None

    if len(track) == 1:
        off_route_m, _ = _point_segment_projection(
            lat,
            lon,
            track[0].lat,
            track[0].lon,
            track[0].lat,
            track[0].lon,
        )
        return RouteProjection(track[0].distance_km, off_route_m)

    best_off_route_m = float("inf")
    best_along_km = 0.0
    bbox_margin_m = search_radius_m if search_radius_m is not None else float("inf")

    for index in range(len(track) - 1):
        start = track[index]
        end = track[index + 1]
        south, west, north, east = _segment_bounding_box(
            start.lat,
            start.lon,
            end.lat,
            end.lon,
        )
        if not _point_near_bbox(lat, lon, south, west, north, east, bbox_margin_m):
            continue

        off_route_m, fraction = _point_segment_projection(
            lat,
            lon,
            start.lat,
            start.lon,
            end.lat,
            end.lon,
        )
        if off_route_m < best_off_route_m:
            best_off_route_m = off_route_m
            bbox_margin_m = best_off_route_m
            segment_length_km = end.distance_km - start.distance_km
            best_along_km = start.distance_km + fraction * segment_length_km

    if best_off_route_m == float("inf"):
        return None

    return RouteProjection(best_along_km, best_off_route_m)
