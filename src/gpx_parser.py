"""Parse GPX files and compute basic route statistics."""

import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

# Earth radius in meters (used for haversine distance).
_EARTH_RADIUS_M = 6_371_000


@dataclass
class TrackPoint:
    """A single point along the GPX track with cumulative distance."""

    lat: float
    lon: float
    elevation_m: float | None
    distance_km: float


@dataclass
class GpxStats:
    """Summary statistics extracted from a GPX track."""

    distance_km: float
    elevation_gain_m: float
    track_point_count: int


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in meters between two lat/lon points."""
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)

    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _parse_elevation(trkpt: ET.Element) -> float | None:
    """Read elevation from a track point, if present."""
    # GPX may use a namespace; match any child tag ending in "ele".
    for child in trkpt:
        if child.tag.endswith("ele") and child.text is not None:
            return float(child.text)
    return None


def _extract_track_points(root: ET.Element) -> list[tuple[float, float, float | None]]:
    """Return (lat, lon, elevation) for every trkpt in the GPX file."""
    points: list[tuple[float, float, float | None]] = []

    # Namespace-agnostic: works with GPX 1.0 and 1.1.
    for trkpt in root.iter():
        if not trkpt.tag.endswith("trkpt"):
            continue

        lat = trkpt.get("lat")
        lon = trkpt.get("lon")
        if lat is None or lon is None:
            continue

        points.append((float(lat), float(lon), _parse_elevation(trkpt)))

    return points


def _build_track_points(raw_points: list[tuple[float, float, float | None]]) -> list[TrackPoint]:
    """Convert raw GPX points into track points with cumulative distance."""
    track: list[TrackPoint] = []
    cumulative_km = 0.0

    for i, (lat, lon, elevation_m) in enumerate(raw_points):
        if i > 0:
            prev_lat, prev_lon, _ = raw_points[i - 1]
            cumulative_km += _haversine_m(prev_lat, prev_lon, lat, lon) / 1000

        track.append(
            TrackPoint(
                lat=lat,
                lon=lon,
                elevation_m=elevation_m,
                distance_km=cumulative_km,
            )
        )

    return track


def _compute_distance_km(points: list[tuple[float, float, float | None]]) -> float:
    """Sum haversine distances between consecutive track points."""
    if not points:
        return 0.0
    return _build_track_points(points)[-1].distance_km


def _compute_elevation_gain_m(points: list[tuple[float, float, float | None]]) -> float:
    """Sum only upward elevation changes between consecutive points."""
    gain = 0.0
    for i in range(1, len(points)):
        prev_ele = points[i - 1][2]
        curr_ele = points[i][2]
        if prev_ele is None or curr_ele is None:
            continue
        diff = curr_ele - prev_ele
        if diff > 0:
            gain += diff
    return gain


def load_gpx(path: Path) -> tuple[GpxStats, list[TrackPoint]]:
    """
    Read a GPX file once and return both summary stats and track points.

    Avoids parsing the same file twice during analysis.
    """
    if not path.is_file():
        raise FileNotFoundError(f"GPX file not found: {path}")

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise ValueError(f"Invalid or empty GPX file: {path}") from exc

    raw_points = _extract_track_points(root)
    if not raw_points:
        raise ValueError(f"No track points found in: {path}")

    track = _build_track_points(raw_points)
    stats = GpxStats(
        distance_km=track[-1].distance_km,
        elevation_gain_m=_compute_elevation_gain_m(raw_points),
        track_point_count=len(track),
    )
    return stats, track


def parse_gpx_track(path: Path) -> list[TrackPoint]:
    """
    Read a GPX file and return ordered track points with cumulative distance.

    Raises:
        FileNotFoundError: if the file does not exist.
        ValueError: if the file is empty or contains no track points.
    """
    if not path.is_file():
        raise FileNotFoundError(f"GPX file not found: {path}")

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise ValueError(f"Invalid or empty GPX file: {path}") from exc

    raw_points = _extract_track_points(root)
    if not raw_points:
        raise ValueError(f"No track points found in: {path}")

    return _build_track_points(raw_points)


def parse_gpx(path: Path) -> GpxStats:
    """
    Read a GPX file and return distance, elevation gain, and track point count.

    Raises:
        FileNotFoundError: if the file does not exist.
        ValueError: if the file is empty or contains no track points.
    """
    stats, _track = load_gpx(path)
    return stats
