"""Spatial index for fast point-to-route projection."""

from __future__ import annotations

import math
from dataclasses import dataclass

from gpx_parser import TrackPoint
from route_geometry import (
    RouteProjection,
    _METERS_PER_DEG_LAT,
    _meters_per_deg_lon,
    _point_near_bbox,
    _point_segment_projection,
    _segment_bounding_box,
)

CELL_SIZE_M = 250.0
QUERY_CELL_PADDING = 1


@dataclass
class RouteSegmentIndex:
    """Uniform spatial grid indexing GPX track segments."""

    track: list[TrackPoint]
    segment_bboxes: list[tuple[float, float, float, float]]
    cells: dict[tuple[int, int], list[int]]
    origin_lat: float
    origin_lon: float

    @classmethod
    def build(cls, track: list[TrackPoint]) -> RouteSegmentIndex:
        if len(track) < 2:
            origin_lat = track[0].lat if track else 0.0
            origin_lon = track[0].lon if track else 0.0
            return cls(track=track, segment_bboxes=[], cells={}, origin_lat=origin_lat, origin_lon=origin_lon)

        origin_lat = sum(point.lat for point in track) / len(track)
        origin_lon = sum(point.lon for point in track) / len(track)

        segment_bboxes: list[tuple[float, float, float, float]] = []
        cells: dict[tuple[int, int], list[int]] = {}
        for index in range(len(track) - 1):
            start = track[index]
            end = track[index + 1]
            bbox = _segment_bounding_box(start.lat, start.lon, end.lat, end.lon)
            segment_bboxes.append(bbox)
            for cell_key in _bbox_cell_keys(bbox, origin_lat, origin_lon):
                cells.setdefault(cell_key, []).append(index)

        return cls(
            track=track,
            segment_bboxes=segment_bboxes,
            cells=cells,
            origin_lat=origin_lat,
            origin_lon=origin_lon,
        )

    def project(
        self,
        lat: float,
        lon: float,
        *,
        search_radius_m: float,
    ) -> RouteProjection | None:
        if not self.track:
            return None

        if len(self.track) == 1:
            point = self.track[0]
            off_route_m, _ = _point_segment_projection(
                lat,
                lon,
                point.lat,
                point.lon,
                point.lat,
                point.lon,
            )
            return RouteProjection(point.distance_km, off_route_m)

        candidate_indices = self._candidate_segment_indices(lat, lon, search_radius_m)
        best_off_route_m = float("inf")
        best_along_km = 0.0

        for index in candidate_indices:
            start = self.track[index]
            end = self.track[index + 1]
            south, west, north, east = self.segment_bboxes[index]
            if not _point_near_bbox(lat, lon, south, west, north, east, search_radius_m):
                continue

            off_route_m, fraction = _point_segment_projection(
                lat,
                lon,
                start.lat,
                start.lon,
                end.lat,
                end.lon,
            )
            if off_route_m >= best_off_route_m:
                continue

            best_off_route_m = off_route_m
            segment_length_km = end.distance_km - start.distance_km
            best_along_km = start.distance_km + fraction * segment_length_km

        if best_off_route_m == float("inf"):
            return None

        return RouteProjection(best_along_km, best_off_route_m)

    def _candidate_segment_indices(
        self,
        lat: float,
        lon: float,
        search_radius_m: float,
    ) -> list[int]:
        cell_x, cell_y = _point_cell(lat, lon, self.origin_lat, self.origin_lon)
        padding = QUERY_CELL_PADDING + int(math.ceil(search_radius_m / CELL_SIZE_M))
        indices: list[int] = []
        seen: set[int] = set()

        for dx in range(-padding, padding + 1):
            for dy in range(-padding, padding + 1):
                for index in self.cells.get((cell_x + dx, cell_y + dy), []):
                    if index in seen:
                        continue
                    seen.add(index)
                    indices.append(index)

        return indices


def _point_cell(lat: float, lon: float, origin_lat: float, origin_lon: float) -> tuple[int, int]:
    meters_lon = _meters_per_deg_lon(origin_lat)
    x_m = (lon - origin_lon) * meters_lon
    y_m = (lat - origin_lat) * _METERS_PER_DEG_LAT
    return int(math.floor(x_m / CELL_SIZE_M)), int(math.floor(y_m / CELL_SIZE_M))


def _bbox_cell_keys(
    bbox: tuple[float, float, float, float],
    origin_lat: float,
    origin_lon: float,
) -> set[tuple[int, int]]:
    south, west, north, east = bbox
    min_x, max_x = _point_cell(south, west, origin_lat, origin_lon)[0], _point_cell(north, east, origin_lat, origin_lon)[0]
    min_y, max_y = _point_cell(south, west, origin_lat, origin_lon)[1], _point_cell(north, east, origin_lat, origin_lon)[1]
    return {(x, y) for x in range(min_x, max_x + 1) for y in range(min_y, max_y + 1)}
