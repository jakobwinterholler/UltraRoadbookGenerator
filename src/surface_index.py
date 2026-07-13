"""Uniform spatial grid for fast nearby OSM segment lookup."""

import math
from dataclasses import dataclass

from surface_matcher import (
    MAX_SNAP_DISTANCE_M,
    OsmWaySegment,
    _meters_per_deg_lon,
)

# --- Grid tuning parameters ---

# Width/height of each grid cell in meters.
CELL_SIZE_M = 50.0

# Extra cell ring searched around each query point (1 => 3x3 cells).
QUERY_CELL_PADDING = 1

_METERS_PER_DEG_LAT = 110_540.0


@dataclass
class SpatialGridIndex:
    """
    Uniform spatial hash indexing OSM segments by local meter coordinates.

    Each segment is inserted into every cell its bounding box touches so that
    nearby-segment queries remain conservative (no valid matches are dropped).
    """

    segments: list[OsmWaySegment]
    segment_bboxes: list[tuple[float, float, float, float]]
    cells: dict[tuple[int, int], list[int]]
    origin_lat: float
    origin_lon: float

    @classmethod
    def build(cls, segments: list[OsmWaySegment]) -> "SpatialGridIndex":
        """Build a spatial index for all OSM segments."""
        if not segments:
            return cls(
                segments=[],
                segment_bboxes=[],
                cells={},
                origin_lat=0.0,
                origin_lon=0.0,
            )

        origin_lat = sum(segment.start_lat + segment.end_lat for segment in segments) / (2 * len(segments))
        origin_lon = sum(segment.start_lon + segment.end_lon for segment in segments) / (2 * len(segments))

        segment_bboxes = [_segment_bbox(segment) for segment in segments]
        cells: dict[tuple[int, int], list[int]] = {}

        for index, bbox in enumerate(segment_bboxes):
            for cell_key in _bbox_cell_keys(bbox, origin_lat, origin_lon, MAX_SNAP_DISTANCE_M):
                cells.setdefault(cell_key, []).append(index)

        return cls(
            segments=segments,
            segment_bboxes=segment_bboxes,
            cells=cells,
            origin_lat=origin_lat,
            origin_lon=origin_lon,
        )

    def nearby_segment_indices(self, lat: float, lon: float) -> list[int]:
        """Return segment indices in grid cells near the given point."""
        cell_x, cell_y = _latlon_to_cell(lat, lon, self.origin_lat, self.origin_lon)
        seen: set[int] = set()
        nearby: list[int] = []

        for dx in range(-QUERY_CELL_PADDING, QUERY_CELL_PADDING + 1):
            for dy in range(-QUERY_CELL_PADDING, QUERY_CELL_PADDING + 1):
                for segment_index in self.cells.get((cell_x + dx, cell_y + dy), []):
                    if segment_index not in seen:
                        seen.add(segment_index)
                        nearby.append(segment_index)

        return nearby


def _segment_bbox(segment: OsmWaySegment) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) for one segment."""
    lats = (segment.start_lat, segment.end_lat)
    lons = (segment.start_lon, segment.end_lon)
    return min(lats), min(lons), max(lats), max(lons)


def _latlon_to_local_m(
    lat: float,
    lon: float,
    origin_lat: float,
    origin_lon: float,
) -> tuple[float, float]:
    """Project lat/lon to local meters relative to an origin."""
    x_m = (lon - origin_lon) * _meters_per_deg_lon(origin_lat)
    y_m = (lat - origin_lat) * _METERS_PER_DEG_LAT
    return x_m, y_m


def _latlon_to_cell(lat: float, lon: float, origin_lat: float, origin_lon: float) -> tuple[int, int]:
    """Convert a lat/lon position to integer grid coordinates."""
    x_m, y_m = _latlon_to_local_m(lat, lon, origin_lat, origin_lon)
    return math.floor(x_m / CELL_SIZE_M), math.floor(y_m / CELL_SIZE_M)


def _bbox_cell_keys(
    bbox: tuple[float, float, float, float],
    origin_lat: float,
    origin_lon: float,
    margin_m: float,
) -> list[tuple[int, int]]:
    """Return all grid cells touched by a bounding box expanded by margin_m."""
    south, west, north, east = bbox

    mean_lat = (south + north) / 2.0
    margin_lat = margin_m / _METERS_PER_DEG_LAT
    margin_lon = margin_m / _meters_per_deg_lon(mean_lat)

    x_min, y_min = _latlon_to_local_m(south - margin_lat, west - margin_lon, origin_lat, origin_lon)
    x_max, y_max = _latlon_to_local_m(north + margin_lat, east + margin_lon, origin_lat, origin_lon)

    min_cell_x = math.floor(min(x_min, x_max) / CELL_SIZE_M)
    max_cell_x = math.floor(max(x_min, x_max) / CELL_SIZE_M)
    min_cell_y = math.floor(min(y_min, y_max) / CELL_SIZE_M)
    max_cell_y = math.floor(max(y_min, y_max) / CELL_SIZE_M)

    keys: list[tuple[int, int]] = []
    for cell_x in range(min_cell_x, max_cell_x + 1):
        for cell_y in range(min_cell_y, max_cell_y + 1):
            keys.append((cell_x, cell_y))

    return keys
