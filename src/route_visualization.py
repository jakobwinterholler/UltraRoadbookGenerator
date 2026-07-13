"""Build route visualization payloads for the interactive map and overlays."""

from dataclasses import dataclass

from gpx_parser import TrackPoint
from resupply_quality import ResupplyQualitySegment, build_resupply_quality_segments
from resupply_zones import ResupplyZone
from surface_detector import SurfaceDataset, SurfaceSegment
from surface_types import RIDER_CATEGORY_COLORS, RiderCategory

MAX_TRACK_POINTS = 1800


@dataclass(frozen=True)
class TrackPointRow:
    lat: float
    lon: float
    km: float
    ele_m: float | None
    cumulative_gain_m: float


@dataclass(frozen=True)
class RouteBounds:
    south: float
    west: float
    north: float
    east: float


@dataclass(frozen=True)
class SurfaceSegmentRow:
    start_km: float
    end_km: float
    surface: str
    color: str
    osm_surface: str | None
    rider_category: str
    rider_subcategory: str
    surface_source: str
    surface_confidence: float


@dataclass(frozen=True)
class RouteVisualization:
    track_points: list[TrackPointRow]
    bounds: RouteBounds
    surface_segments: list[SurfaceSegmentRow]
    resupply_segments: list[ResupplyQualitySegment]


def _decimate_track(track: list[TrackPoint], max_points: int) -> list[TrackPoint]:
    if len(track) <= max_points:
        return track

    step = max(1, len(track) // max_points)
    sampled = track[::step]
    if sampled[-1] is not track[-1]:
        sampled.append(track[-1])
    return sampled


def _build_track_rows(track: list[TrackPoint]) -> list[TrackPointRow]:
    rows: list[TrackPointRow] = []
    cumulative_gain = 0.0

    for index, point in enumerate(track):
        if index > 0:
            previous = track[index - 1]
            if point.elevation_m is not None and previous.elevation_m is not None:
                gain = point.elevation_m - previous.elevation_m
                if gain > 0:
                    cumulative_gain += gain

        rows.append(
            TrackPointRow(
                lat=round(point.lat, 6),
                lon=round(point.lon, 6),
                km=round(point.distance_km, 3),
                ele_m=round(point.elevation_m, 1) if point.elevation_m is not None else None,
                cumulative_gain_m=round(cumulative_gain, 1),
            )
        )

    return rows


def _build_bounds(track: list[TrackPoint]) -> RouteBounds:
    lats = [point.lat for point in track]
    lons = [point.lon for point in track]
    return RouteBounds(
        south=min(lats),
        west=min(lons),
        north=max(lats),
        east=max(lons),
    )


def _surface_color(category: RiderCategory) -> str:
    return RIDER_CATEGORY_COLORS[category]


def _build_surface_segments(surface_dataset: SurfaceDataset) -> list[SurfaceSegmentRow]:
    rows: list[SurfaceSegmentRow] = []
    for segment in surface_dataset.segments:
        resolved = segment.resolved_points
        rows.append(
            SurfaceSegmentRow(
                start_km=round(segment.start_km, 3),
                end_km=round(segment.end_km, 3),
                surface=resolved.rider_category.value,
                color=_surface_color(resolved.rider_category),
                osm_surface=segment.osm_surface,
                rider_category=resolved.rider_category.value,
                rider_subcategory=resolved.rider_subcategory,
                surface_source=resolved.surface_source.value,
                surface_confidence=round(segment.avg_surface_confidence, 3),
            )
        )
    return rows


def build_track_route_visualization(track: list[TrackPoint]) -> RouteVisualization:
    """Create map and elevation data before surface/zone overlays are ready."""
    sampled_track = _decimate_track(track, MAX_TRACK_POINTS)
    return RouteVisualization(
        track_points=_build_track_rows(sampled_track),
        bounds=_build_bounds(track),
        surface_segments=[],
        resupply_segments=[],
    )


def build_route_visualization(
    track: list[TrackPoint],
    surface_dataset: SurfaceDataset,
    zones: list[ResupplyZone],
    *,
    resupply_segments: list[ResupplyQualitySegment] | None = None,
) -> RouteVisualization:
    """Create map, elevation, and overlay data for one analyzed route."""
    sampled_track = _decimate_track(track, MAX_TRACK_POINTS)
    resolved_resupply_segments = resupply_segments
    if resolved_resupply_segments is None:
        resolved_resupply_segments = build_resupply_quality_segments(track, zones)
    return RouteVisualization(
        track_points=_build_track_rows(sampled_track),
        bounds=_build_bounds(track),
        surface_segments=_build_surface_segments(surface_dataset),
        resupply_segments=resolved_resupply_segments,
    )


def lat_lon_at_km(track: list[TrackPoint], km: float) -> tuple[float, float] | None:
    """Interpolate a map position for one distance along the route."""
    if not track:
        return None
    if km <= track[0].distance_km:
        return track[0].lat, track[0].lon
    if km >= track[-1].distance_km:
        return track[-1].lat, track[-1].lon

    for index in range(len(track) - 1):
        start = track[index]
        end = track[index + 1]
        if start.distance_km <= km <= end.distance_km:
            span = end.distance_km - start.distance_km
            if span <= 0:
                return start.lat, start.lon
            fraction = (km - start.distance_km) / span
            lat = start.lat + (end.lat - start.lat) * fraction
            lon = start.lon + (end.lon - start.lon) * fraction
            return lat, lon

    return track[-1].lat, track[-1].lon
