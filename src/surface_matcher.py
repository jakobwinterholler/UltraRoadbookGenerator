"""Sequential GPX-to-OSM map matching with confidence scoring."""

import math
from collections.abc import Callable
from dataclasses import dataclass

from typing import TYPE_CHECKING

from gpx_parser import TrackPoint

if TYPE_CHECKING:
    from surface_index import SpatialGridIndex

# --- Tunable matching parameters ---

# Maximum perpendicular snap distance from a GPX point to an OSM segment (meters).
MAX_SNAP_DISTANCE_M = 25.0

# Slightly wider snap for trail-like highways where GPX often drifts.
TRAIL_SNAP_DISTANCE_M = 30.0
TRAIL_HIGHWAYS = frozenset({"track", "path", "footway", "bridleway", "steps"})

# Limit candidates scored per point — index can return 100+ in dense OSM.
MAX_CANDIDATES_PER_POINT = 16

# Penalty added to match score when bearing differs from travel direction (meters equivalent).
BEARING_WEIGHT_M = 0.5

# Penalty added when the match switches to a different OSM way (meters equivalent).
CONTINUITY_PENALTY_M = 8.0

# Approximate meters per degree latitude (used for local projection).
_METERS_PER_DEG_LAT = 110_540.0


@dataclass(frozen=True)
class OsmWaySegment:
    """One geometry segment of an OpenStreetMap highway way."""

    way_id: int
    tags: dict[str, str]
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float


@dataclass(frozen=True)
class SegmentCandidate:
    """A possible snap target for one GPX point."""

    segment: OsmWaySegment
    snap_distance_m: float
    bearing_diff_deg: float


@dataclass(frozen=True)
class MatchScore:
    """Weighted score used to choose the best OSM segment (lower is better)."""

    total: float
    snap_distance_m: float
    bearing_diff_deg: float
    continuity_penalty_m: float


@dataclass(frozen=True)
class PointMatchResult:
    """Result of matching one GPX point to the OSM network."""

    matched: bool
    way_id: int | None
    tags: dict[str, str]
    osm_surface: str | None
    snap_distance_m: float
    bearing_diff_deg: float
    confidence: float


def _meters_per_deg_lon(lat_deg: float) -> float:
    return 111_320.0 * math.cos(math.radians(lat_deg))


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return forward bearing in degrees [0, 360)."""
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlon_r = math.radians(lon2 - lon1)

    y = math.sin(dlon_r) * math.cos(lat2_r)
    x = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon_r)
    return math.degrees(math.atan2(y, x)) % 360.0


def _bearing_difference_deg(bearing_a: float, bearing_b: float) -> float:
    """Return the smallest angle between two bearings in degrees [0, 180]."""
    diff = abs(bearing_a - bearing_b) % 360.0
    return diff if diff <= 180.0 else 360.0 - diff


def _segment_bearing_deg(segment: OsmWaySegment) -> float:
    return _bearing_deg(segment.start_lat, segment.start_lon, segment.end_lat, segment.end_lon)


def _travel_bearing_deg(track: list[TrackPoint], index: int) -> float | None:
    """Estimate direction of travel at a track point using neighbouring points."""
    if len(track) < 2:
        return None

    if 0 < index < len(track) - 1:
        prev_point = track[index - 1]
        next_point = track[index + 1]
    elif index == 0:
        prev_point = track[0]
        next_point = track[1]
    else:
        prev_point = track[-2]
        next_point = track[-1]

    return _bearing_deg(prev_point.lat, prev_point.lon, next_point.lat, next_point.lon)


def _point_segment_distance_m(
    point_lat: float,
    point_lon: float,
    seg_start_lat: float,
    seg_start_lon: float,
    seg_end_lat: float,
    seg_end_lon: float,
) -> float:
    """Return the shortest distance in meters from a point to a line segment."""
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
        return math.hypot(px - x1, py - y1)

    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / segment_length_sq))
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    return math.hypot(px - closest_x, py - closest_y)


def _segment_bounding_box(segment: OsmWaySegment) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) for quick rejection tests."""
    lats = (segment.start_lat, segment.end_lat)
    lons = (segment.start_lon, segment.end_lon)
    return min(lats), min(lons), max(lats), max(lons)


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


@dataclass(frozen=True)
class MatchTrackStats:
    """Diagnostics collected while matching GPX points to OSM."""

    gpx_point_count: int
    osm_segment_count: int
    total_index_candidates: int
    avg_candidates_per_point: float


def _snap_limit_for_segment(segment: OsmWaySegment) -> float:
    highway = segment.tags.get("highway")
    if highway in TRAIL_HIGHWAYS:
        return TRAIL_SNAP_DISTANCE_M
    return MAX_SNAP_DISTANCE_M


def _find_candidates(
    lat: float,
    lon: float,
    travel_bearing_deg: float | None,
    segment_indices: list[int],
    segments: list[OsmWaySegment],
    segment_bboxes: list[tuple[float, float, float, float]],
) -> list[SegmentCandidate]:
    """Return OSM segments within snap distance of the GPX point."""
    candidates: list[SegmentCandidate] = []
    max_snap = MAX_SNAP_DISTANCE_M

    for segment_index in segment_indices:
        segment = segments[segment_index]
        snap_limit = _snap_limit_for_segment(segment)
        max_snap = max(max_snap, snap_limit)
        bbox = segment_bboxes[segment_index]
        south, west, north, east = bbox
        if not _point_near_bbox(lat, lon, south, west, north, east, snap_limit):
            continue

        snap_distance_m = _point_segment_distance_m(
            lat,
            lon,
            segment.start_lat,
            segment.start_lon,
            segment.end_lat,
            segment.end_lon,
        )
        if snap_distance_m > snap_limit:
            continue

        if travel_bearing_deg is None:
            bearing_diff_deg = 0.0
        else:
            bearing_diff_deg = _bearing_difference_deg(travel_bearing_deg, _segment_bearing_deg(segment))

        candidates.append(
            SegmentCandidate(
                segment=segment,
                snap_distance_m=snap_distance_m,
                bearing_diff_deg=bearing_diff_deg,
            )
        )

    if len(candidates) > MAX_CANDIDATES_PER_POINT:
        candidates.sort(key=lambda item: item.snap_distance_m)
        candidates = candidates[:MAX_CANDIDATES_PER_POINT]

    return candidates


def _score_candidate(
    candidate: SegmentCandidate,
    previous_way_id: int | None,
) -> MatchScore:
    """Convert a geometric candidate into a weighted match score."""
    continuity_penalty_m = 0.0
    if previous_way_id is not None and candidate.segment.way_id != previous_way_id:
        continuity_penalty_m = CONTINUITY_PENALTY_M

    total = (
        candidate.snap_distance_m
        + BEARING_WEIGHT_M * candidate.bearing_diff_deg
        + continuity_penalty_m
    )
    return MatchScore(
        total=total,
        snap_distance_m=candidate.snap_distance_m,
        bearing_diff_deg=candidate.bearing_diff_deg,
        continuity_penalty_m=continuity_penalty_m,
    )


def _compute_confidence(
    snap_distance_m: float,
    bearing_diff_deg: float,
    continuity_penalty_m: float,
) -> float:
    """
    Compute a confidence value in [0, 1] from match quality signals.

    Higher confidence means the snap distance is small, bearing agrees with travel
    direction, and the match continues on the same OSM way as the previous point.
    """
    distance_factor = max(0.0, 1.0 - snap_distance_m / MAX_SNAP_DISTANCE_M)
    bearing_factor = max(0.0, 1.0 - bearing_diff_deg / 90.0)
    continuity_factor = 1.0 if continuity_penalty_m == 0.0 else 0.6

    confidence = 0.5 * distance_factor + 0.3 * bearing_factor + 0.2 * continuity_factor
    return round(min(max(confidence, 0.0), 1.0), 3)


def _empty_match() -> PointMatchResult:
    """Return a non-match result with zero confidence."""
    return PointMatchResult(
        matched=False,
        way_id=None,
        tags={},
        osm_surface=None,
        snap_distance_m=MAX_SNAP_DISTANCE_M,
        bearing_diff_deg=180.0,
        confidence=0.0,
    )


def match_point(
    lat: float,
    lon: float,
    travel_bearing_deg: float | None,
    segment_indices: list[int],
    segments: list[OsmWaySegment],
    segment_bboxes: list[tuple[float, float, float, float]],
    previous_way_id: int | None,
) -> PointMatchResult:
    """Match one GPX point to the best OSM segment candidate."""
    candidates = _find_candidates(
        lat,
        lon,
        travel_bearing_deg,
        segment_indices,
        segments,
        segment_bboxes,
    )
    if not candidates:
        return _empty_match()

    best_candidate: SegmentCandidate | None = None
    best_score: MatchScore | None = None

    for candidate in candidates:
        score = _score_candidate(candidate, previous_way_id)
        if best_score is None:
            best_candidate = candidate
            best_score = score
            continue

        same_way_bonus = (
            previous_way_id is not None
            and candidate.segment.way_id == previous_way_id
            and best_candidate is not None
            and best_candidate.segment.way_id != previous_way_id
            and score.total <= best_score.total + 5.0
        )
        if score.total < best_score.total or same_way_bonus:
            best_candidate = candidate
            best_score = score

    assert best_candidate is not None
    assert best_score is not None

    tags = dict(best_candidate.segment.tags)
    osm_surface = tags.get("surface")

    return PointMatchResult(
        matched=True,
        way_id=best_candidate.segment.way_id,
        tags=tags,
        osm_surface=osm_surface,
        snap_distance_m=round(best_candidate.snap_distance_m, 2),
        bearing_diff_deg=round(best_candidate.bearing_diff_deg, 2),
        confidence=_compute_confidence(
            best_candidate.snap_distance_m,
            best_candidate.bearing_diff_deg,
            best_score.continuity_penalty_m,
        ),
    )


def match_track(
    track: list[TrackPoint],
    spatial_index: "SpatialGridIndex",
    *,
    progress_callback: Callable[[int], None] | None = None,
) -> tuple[list[PointMatchResult], MatchTrackStats]:
    """
    Match every GPX point to OSM using sequential scoring.

    Uses a pre-built spatial grid index to pre-filter candidate segments.
    The scoring logic (distance + bearing + continuity) is unchanged.
    """
    if not track:
        empty_stats = MatchTrackStats(
            gpx_point_count=0,
            osm_segment_count=len(spatial_index.segments),
            total_index_candidates=0,
            avg_candidates_per_point=0.0,
        )
        return [], empty_stats

    results: list[PointMatchResult] = []
    previous_way_id: int | None = None
    total_index_candidates = 0
    total_points = len(track)
    last_reported_percent = -1

    for index, point in enumerate(track):
        travel_bearing = _travel_bearing_deg(track, index)
        nearby_indices = spatial_index.nearby_segment_indices(point.lat, point.lon)
        total_index_candidates += len(nearby_indices)

        result = match_point(
            point.lat,
            point.lon,
            travel_bearing,
            nearby_indices,
            spatial_index.segments,
            spatial_index.segment_bboxes,
            previous_way_id,
        )
        results.append(result)
        previous_way_id = result.way_id if result.matched else None

        if progress_callback is not None:
            percent = int(((index + 1) / total_points) * 100)
            if percent % 10 == 0 and percent != last_reported_percent:
                progress_callback(percent)
                last_reported_percent = percent

    if progress_callback is not None and last_reported_percent < 100:
        progress_callback(100)

    avg_candidates = total_index_candidates / total_points if total_points else 0.0
    stats = MatchTrackStats(
        gpx_point_count=total_points,
        osm_segment_count=len(spatial_index.segments),
        total_index_candidates=total_index_candidates,
        avg_candidates_per_point=round(avg_candidates, 1),
    )
    return results, stats
