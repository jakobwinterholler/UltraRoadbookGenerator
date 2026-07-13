"""Surface detection engine: OSM download, GPX matching, and segment assembly."""

import json
import math
import time
from dataclasses import dataclass
from pathlib import Path

from gpx_parser import TrackPoint
from osm_cache_store import (
    SURFACE_ALGORITHM_VERSION,
    invalidate_processed_geometry,
    load_processed_surface_geometry,
    save_processed_surface_geometry,
)
from osm_fetch import fetch_overpass_query
from progress import ProgressReporter
from surface_matcher import MatchTrackStats, OsmWaySegment, PointMatchResult, match_track
from surface_index import SpatialGridIndex
from surface_inference import propagate_resolved_surfaces, resolve_point_surface
from surface_types import (
    INTERNAL_UNKNOWN,
    ResolvedSurface,
    RiderCategory,
    SurfaceSource,
    SurfaceSummary,
    is_missing_osm_surface,
    report_group_for_rider,
    report_group_for_surface,
)

MATCH_DECIMATION_FACTOR = 2

# --- OSM download settings ---

# Buffer around the route bounding box for Overpass queries (meters).
BBOX_BUFFER_M = 50.0

_METERS_PER_DEG_LAT = 110_540.0


@dataclass(frozen=True)
class PointSurfaceRecord:
    """Surface classification and match metadata for one GPX point."""

    distance_km: float
    lat: float
    lon: float
    osm_surface: str | None
    matched: bool
    way_id: int | None
    tags: dict[str, str]
    confidence: float
    snap_distance_m: float
    bearing_diff_deg: float
    resolved: ResolvedSurface


@dataclass(frozen=True)
class SurfaceSegment:
    """A contiguous stretch of route with one rider-facing surface classification."""

    start_km: float
    end_km: float
    length_km: float
    osm_surface: str | None
    matched: bool
    way_id: int | None
    tags: dict[str, str]
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    avg_confidence: float
    resolved_points: ResolvedSurface
    avg_surface_confidence: float


@dataclass(frozen=True)
class UnknownSegment:
    """A segment flagged for manual review because OSM surface data is missing."""

    start_km: float
    end_km: float
    length_km: float
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    avg_confidence: float


@dataclass(frozen=True)
class SurfaceDataset:
    """Complete surface-detection output for one route."""

    points: list[PointSurfaceRecord]
    segments: list[SurfaceSegment]
    unknown_segments: list[UnknownSegment]
    summary: SurfaceSummary
    runtime: "SurfaceRuntimeReport"
    match_stats: MatchTrackStats
    diagnostics: dict | None = None
    osm_downloaded: bool = False
    processed_geometry_hit: bool = False


@dataclass(frozen=True)
class SurfaceRuntimeReport:
    """Measured runtime for each surface-detection stage."""

    osm_load_s: float
    json_parse_s: float
    simplify_s: float
    index_build_s: float
    matching_s: float
    inference_s: float
    merge_s: float
    total_s: float


def _meters_per_deg_lon(lat_deg: float) -> float:
    return 111_320.0 * math.cos(math.radians(lat_deg))


def _track_bounding_box(
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


def _cache_path(cache_dir: Path, gpx_path: Path) -> Path:
    return cache_dir / f"{gpx_path.stem}.json"


def _build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    return f"""
    [out:json][timeout:180];
    (
      way["highway"]({south},{west},{north},{east});
    );
    out geom tags;
    """


def _fetch_osm_elements(bbox: tuple[float, float, float, float]) -> list[dict]:
    """Download OSM highway ways from Overpass for one bounding box."""
    query = _build_overpass_query(bbox)
    return fetch_overpass_query(query)


def surface_bbox(track: list[TrackPoint]) -> tuple[float, float, float, float]:
    return _track_bounding_box(track, BBOX_BUFFER_M)


def load_surface_osm_elements(
    track: list[TrackPoint],
    cache_dir: Path,
    gpx_path: Path,
    *,
    refresh_osm: bool = False,
) -> tuple[list[dict] | None, bool]:
    """
    Load cached surface elements without downloading.

    Returns (elements, downloaded) where downloaded is True when cache missed.
    """
    cache_file = _cache_path(cache_dir, gpx_path)
    if refresh_osm:
        if cache_file.is_file():
            cache_file.unlink()
        invalidate_processed_geometry(cache_dir, gpx_path)
        return None, True

    elements = _load_osm_cache(cache_file, track)
    if elements is not None:
        return elements, False
    return None, True


def fetch_surface_osm_elements(track: list[TrackPoint], cache_dir: Path, gpx_path: Path) -> list[dict]:
    """Download surface OSM elements and persist the raw JSON cache."""
    bbox = surface_bbox(track)
    elements = _fetch_osm_elements(bbox)
    _save_osm_cache(_cache_path(cache_dir, gpx_path), track, elements)
    return elements


def _load_osm_cache(cache_file: Path, track: list[TrackPoint]) -> list[dict] | None:
    if not cache_file.is_file():
        return None

    with cache_file.open(encoding="utf-8") as handle:
        cached = json.load(handle)

    cached_distance_km = cached.get("route_distance_km")
    current_distance_km = round(track[-1].distance_km, 3)
    if cached_distance_km != current_distance_km:
        return None

    return cached.get("elements", [])


def _save_osm_cache(cache_file: Path, track: list[TrackPoint], elements: list[dict]) -> None:
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "route_distance_km": round(track[-1].distance_km, 3),
        "elements": elements,
    }
    with cache_file.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle)


def _load_osm_elements(
    track: list[TrackPoint],
    cache_dir: Path,
    gpx_path: Path,
    *,
    refresh_osm: bool = False,
    prefetched_elements: list[dict] | None = None,
) -> tuple[list[dict], bool]:
    """
    Load raw OSM elements from cache, prefetch, or Overpass.

    Returns (elements, downloaded) where downloaded is True when Overpass was queried.
    """
    if prefetched_elements is not None:
        return prefetched_elements, True

    cached, needs_download = load_surface_osm_elements(
        track,
        cache_dir,
        gpx_path,
        refresh_osm=refresh_osm,
    )
    if cached is not None:
        return cached, False

    elements = fetch_surface_osm_elements(track, cache_dir, gpx_path)
    return elements, True


def _parse_way_segments(elements: list[dict]) -> list[OsmWaySegment]:
    """Convert raw Overpass way elements into one segment per way (geometry endpoints)."""
    segments: list[OsmWaySegment] = []

    for element in elements:
        if element.get("type") != "way":
            continue

        geometry = element.get("geometry")
        if not geometry or len(geometry) < 2:
            continue

        raw_tags = element.get("tags", {})
        tags = {str(key): str(value) for key, value in raw_tags.items()}
        start = geometry[0]
        end = geometry[-1]
        segments.append(
            OsmWaySegment(
                way_id=int(element["id"]),
                tags=tags,
                start_lat=float(start["lat"]),
                start_lon=float(start["lon"]),
                end_lat=float(end["lat"]),
                end_lon=float(end["lon"]),
            )
        )

    return segments


def _print_stage_done(label: str, elapsed_s: float) -> None:
    print(f"✓ Done ({elapsed_s:.1f}s)")


def detect_surfaces(
    track: list[TrackPoint],
    gpx_path: Path,
    cache_dir: Path,
    *,
    refresh_osm: bool = False,
    progress: ProgressReporter | None = None,
    prefetched_elements: list[dict] | None = None,
) -> SurfaceDataset:
    """
    Detect surface types along the full GPX route.

    Pipeline
    --------
    1. Load or download OSM highway ways (full tag sets preserved in cache).
    2. Build a spatial grid index over OSM segments.
    3. Match each GPX point sequentially using distance, bearing, and continuity.
    4. Store exact raw OSM ``surface`` strings without normalisation.
    5. Merge consecutive points into segments and build review outputs.
    """
    total_start = time.perf_counter()

    if not track:
        empty_summary = SurfaceSummary(road_km=0.0, gravel_km=0.0, trail_km=0.0, unknown_km=0.0)
        empty_runtime = SurfaceRuntimeReport(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        empty_stats = MatchTrackStats(0, 0, 0, 0.0)
        return SurfaceDataset([], [], [], empty_summary, empty_runtime, empty_stats, None)

    print("Loading OSM...")
    load_start = time.perf_counter()
    cache_file = _cache_path(cache_dir, gpx_path)

    processed_geometry = load_processed_surface_geometry(
        cache_dir,
        gpx_path,
        track,
        refresh_osm=refresh_osm,
    )
    processed_geometry_hit = processed_geometry is not None

    if processed_geometry_hit:
        elements = []
        downloaded = False
        using_cache = True
        if progress is not None:
            progress.start("osm_surface_data", label="Using processed geometry cache")
            progress.complete("osm_surface_data", label="Using processed geometry cache")
            progress.milestone("Using processed geometry cache")
    else:
        using_cache = (
            prefetched_elements is None
            and not refresh_osm
            and _load_osm_cache(cache_file, track) is not None
        )
        if progress is not None:
            progress.start("osm_surface_data", label=progress.osm_surface_label(not using_cache))
        elements, downloaded = _load_osm_elements(
            track,
            cache_dir,
            gpx_path,
            refresh_osm=refresh_osm,
            prefetched_elements=prefetched_elements,
        )
        if progress is not None:
            progress.complete("osm_surface_data", label=progress.osm_surface_label(downloaded))
            progress.milestone(
                "Downloaded surface OSM data"
                if downloaded
                else "Using cached surface OSM data",
            )

    load_elapsed = time.perf_counter() - load_start
    if processed_geometry_hit:
        print(f"✓ Done ({load_elapsed:.1f}s, geometry cache)")
    elif downloaded:
        _print_stage_done("Loading OSM", load_elapsed)
    else:
        print(f"✓ Done ({load_elapsed:.1f}s, from cache)")

    if processed_geometry is not None:
        print(f"Using processed geometry cache ({processed_geometry.load_s:.1f}s)...")
        osm_segments = processed_geometry.segments
        spatial_index = processed_geometry.spatial_index
        raw_osm_segments = osm_segments
        parse_elapsed = processed_geometry.load_s
        simplify_elapsed = 0.0
        index_elapsed = 0.0
        if progress is not None:
            progress.start("detecting_surfaces")
            progress.transition("Using processed geometry cache")
    else:
        print("Parsing OSM ways...")
        if progress is not None:
            progress.start("detecting_surfaces")
            progress.subprogress("detecting_surfaces", 0, 1, "Parsing roads")
        parse_start = time.perf_counter()
        raw_osm_segments = _parse_way_segments(elements)
        osm_segments = raw_osm_segments
        parse_elapsed = time.perf_counter() - parse_start
        _print_stage_done("Parsing OSM ways", parse_elapsed)
        simplify_elapsed = 0.0

        print("Building spatial index...")
        index_start = time.perf_counter()
        spatial_index = SpatialGridIndex.build(osm_segments)
        index_elapsed = time.perf_counter() - index_start
        _print_stage_done("Building spatial index", index_elapsed)

        save_processed_surface_geometry(
            cache_dir,
            gpx_path,
            track,
            osm_segments,
            spatial_index,
            raw_element_count=len(elements),
        )
        if progress is not None:
            progress.milestone("Parsed OSM roads")

    print("Matching GPX points...")

    def _report_match_progress(percent: int) -> None:
        if progress is not None:
            current = max(1, int(len(track) * percent / 100))
            progress.subprogress(
                "detecting_surfaces",
                current,
                len(track),
                "Matching route segments",
            )
            progress.update_stats(surface_pct=percent)

    match_start = time.perf_counter()
    match_track_points, decimation_factor = _decimate_track_for_matching(track)
    match_results, match_stats = match_track(
        match_track_points,
        spatial_index,
        progress_callback=_report_match_progress,
    )
    match_results_full = _expand_match_results(track, match_track_points, match_results, decimation_factor)
    match_elapsed = time.perf_counter() - match_start
    _print_stage_done("Matching GPX points", match_elapsed)

    print("Resolving surfaces...")
    if progress is not None:
        progress.subprogress(
            "detecting_surfaces",
            len(track),
            len(track),
            "Surface inference",
        )
        progress.transition("Running surface inference")
    inference_start = time.perf_counter()
    resolved_list = [
        resolve_point_surface(
            matched=match.matched,
            osm_surface=match.osm_surface,
            tags=match.tags,
            match_confidence=match.confidence,
            snap_distance_m=match.snap_distance_m,
        )
        for match in match_results_full
    ]
    resolved_list = propagate_resolved_surfaces(
        resolved_list,
        [point.distance_km for point in track],
    )
    inference_elapsed = time.perf_counter() - inference_start
    _print_stage_done("Resolving surfaces", inference_elapsed)

    print("Merging surface segments...")
    merge_start = time.perf_counter()
    if progress is not None:
        progress.subprogress(
            "detecting_surfaces",
            len(track),
            len(track),
            "Merging surface segments",
        )
        progress.transition("Merging surface segments")
    points = [
        _point_record(track_point, match, resolved)
        for track_point, match, resolved in zip(track, match_results_full, resolved_list)
    ]
    segments = _build_surface_segments(points)
    unknown_segments = _extract_unknown_segments(segments)
    summary = _build_summary(segments)
    merge_elapsed = time.perf_counter() - merge_start
    _print_stage_done("Merging surface segments", merge_elapsed)
    if progress is not None:
        progress.complete("detecting_surfaces")
        progress.readiness("surface", "ready")
        progress.update_stats(surface_pct=100)

    total_elapsed = time.perf_counter() - total_start
    runtime = SurfaceRuntimeReport(
        osm_load_s=round(load_elapsed, 2),
        json_parse_s=round(parse_elapsed, 2),
        simplify_s=round(simplify_elapsed, 2),
        index_build_s=round(index_elapsed, 2),
        matching_s=round(match_elapsed, 2),
        inference_s=round(inference_elapsed, 2),
        merge_s=round(merge_elapsed, 2),
        total_s=round(total_elapsed, 2),
    )

    from surface_diagnostics import build_surface_diagnostics

    diagnostics = build_surface_diagnostics(
        points,
        runtime,
        inference_s=inference_elapsed,
        simplify_s=simplify_elapsed,
        decimation_factor=decimation_factor,
        osm_segment_count_raw=len(raw_osm_segments),
        osm_segment_count_indexed=len(osm_segments),
        avg_candidates_per_point=match_stats.avg_candidates_per_point,
    ).to_dict()

    return SurfaceDataset(
        points=points,
        segments=segments,
        unknown_segments=unknown_segments,
        summary=summary,
        runtime=runtime,
        match_stats=match_stats,
        diagnostics=diagnostics,
        osm_downloaded=downloaded,
        processed_geometry_hit=processed_geometry_hit,
    )


def _decimate_track_for_matching(track: list[TrackPoint]) -> tuple[list[TrackPoint], int]:
    """Return a decimated track for matching plus the decimation factor used."""
    factor = MATCH_DECIMATION_FACTOR
    if len(track) <= 8000:
        return track, 1
    sampled = track[::factor]
    if sampled[-1] is not track[-1]:
        sampled.append(track[-1])
    return sampled, factor


def _expand_match_results(
    full_track: list[TrackPoint],
    match_track_points: list[TrackPoint],
    match_results: list[PointMatchResult],
    decimation_factor: int,
) -> list[PointMatchResult]:
    """Map decimated match results back to every GPX point."""
    if decimation_factor == 1 or len(match_track_points) == len(full_track):
        return match_results

    expanded: list[PointMatchResult] = []
    match_index = 0
    for full_index, point in enumerate(full_track):
        while (
            match_index < len(match_track_points) - 1
            and match_track_points[match_index + 1].distance_km <= point.distance_km
        ):
            match_index += 1
        expanded.append(match_results[match_index])
    return expanded


def _segment_key(resolved: ResolvedSurface) -> str:
    """Build a merge key from rider-facing classification."""
    if resolved.rider_category == RiderCategory.UNKNOWN:
        return INTERNAL_UNKNOWN
    return f"{resolved.rider_category.value}:{resolved.rider_subcategory}:{resolved.surface_source.value}"


def _point_record(
    track_point: TrackPoint,
    match: PointMatchResult,
    resolved: ResolvedSurface,
) -> PointSurfaceRecord:
    return PointSurfaceRecord(
        distance_km=track_point.distance_km,
        lat=track_point.lat,
        lon=track_point.lon,
        osm_surface=match.osm_surface,
        matched=match.matched,
        way_id=match.way_id,
        tags=dict(match.tags),
        confidence=match.confidence,
        snap_distance_m=match.snap_distance_m,
        bearing_diff_deg=match.bearing_diff_deg,
        resolved=resolved,
    )


def _build_surface_segments(points: list[PointSurfaceRecord]) -> list[SurfaceSegment]:
    """Merge consecutive points with the same raw OSM surface into segments."""
    if not points:
        return []

    segments: list[SurfaceSegment] = []
    start_point = points[0]
    current_key = _segment_key(start_point.resolved)
    confidence_total = start_point.confidence
    surface_confidence_total = start_point.resolved.confidence
    point_count = 1

    for index in range(1, len(points)):
        point = points[index]
        point_key = _segment_key(point.resolved)

        if point_key != current_key:
            end_point = points[index - 1]
            segments.append(
                SurfaceSegment(
                    start_km=start_point.distance_km,
                    end_km=end_point.distance_km,
                    length_km=end_point.distance_km - start_point.distance_km,
                    osm_surface=start_point.osm_surface,
                    matched=start_point.matched,
                    way_id=start_point.way_id,
                    tags=dict(start_point.tags),
                    start_lat=start_point.lat,
                    start_lon=start_point.lon,
                    end_lat=end_point.lat,
                    end_lon=end_point.lon,
                    avg_confidence=round(confidence_total / point_count, 3),
                    resolved_points=start_point.resolved,
                    avg_surface_confidence=round(surface_confidence_total / point_count, 3),
                )
            )
            start_point = point
            current_key = point_key
            confidence_total = point.confidence
            surface_confidence_total = point.resolved.confidence
            point_count = 1
        else:
            confidence_total += point.confidence
            surface_confidence_total += point.resolved.confidence
            point_count += 1

    end_point = points[-1]
    segments.append(
        SurfaceSegment(
            start_km=start_point.distance_km,
            end_km=end_point.distance_km,
            length_km=end_point.distance_km - start_point.distance_km,
            osm_surface=start_point.osm_surface,
            matched=start_point.matched,
            way_id=start_point.way_id,
            tags=dict(start_point.tags),
            start_lat=start_point.lat,
            start_lon=start_point.lon,
            end_lat=end_point.lat,
            end_lon=end_point.lon,
            avg_confidence=round(confidence_total / point_count, 3),
            resolved_points=start_point.resolved,
            avg_surface_confidence=round(surface_confidence_total / point_count, 3),
        )
    )

    return segments


def _extract_unknown_segments(segments: list[SurfaceSegment]) -> list[UnknownSegment]:
    """Return segments where OSM surface data is missing and needs manual review."""
    unknown_segments: list[UnknownSegment] = []

    for segment in segments:
        if segment.resolved_points.rider_category != RiderCategory.UNKNOWN:
            continue

        unknown_segments.append(
            UnknownSegment(
                start_km=segment.start_km,
                end_km=segment.end_km,
                length_km=segment.length_km,
                start_lat=segment.start_lat,
                start_lon=segment.start_lon,
                end_lat=segment.end_lat,
                end_lon=segment.end_lon,
                avg_confidence=segment.avg_confidence,
            )
        )

    return unknown_segments


def _build_summary(segments: list[SurfaceSegment]) -> SurfaceSummary:
    """Aggregate segment lengths into rider category totals."""
    road_km = 0.0
    gravel_km = 0.0
    trail_km = 0.0
    unknown_km = 0.0

    for segment in segments:
        if not segment.resolved_points:
            continue
        category = segment.resolved_points.rider_category
        if category == RiderCategory.ROAD:
            road_km += segment.length_km
        elif category == RiderCategory.GRAVEL:
            gravel_km += segment.length_km
        elif category == RiderCategory.TRAIL:
            trail_km += segment.length_km
        else:
            unknown_km += segment.length_km

    return SurfaceSummary(
        road_km=round(road_km, 3),
        gravel_km=round(gravel_km, 3),
        trail_km=round(trail_km, 3),
        unknown_km=round(unknown_km, 3),
    )


def print_surface_runtime_report(dataset: SurfaceDataset) -> None:
    """Print per-stage timings and spatial-index diagnostics."""
    runtime = dataset.runtime
    stats = dataset.match_stats

    print()
    print("Surface detection runtime:")
    print(f"  OSM loading:         {runtime.osm_load_s:.2f}s")
    print(f"  JSON parsing:        {runtime.json_parse_s:.2f}s")
    print(f"  Segment simplify:    {runtime.simplify_s:.2f}s")
    print(f"  Spatial index build: {runtime.index_build_s:.2f}s")
    print(f"  Surface matching:    {runtime.matching_s:.2f}s")
    print(f"  Surface inference:   {runtime.inference_s:.2f}s")
    print(f"  Segment merging:     {runtime.merge_s:.2f}s")
    print(f"  Total:               {runtime.total_s:.2f}s")
    print()
    print("Spatial index diagnostics:")
    print(f"  GPX points:                    {stats.gpx_point_count}")
    print(f"  OSM segments:                  {stats.osm_segment_count}")
    print(f"  Avg candidate segments/point:  {stats.avg_candidates_per_point}")


def print_surface_summary(dataset: SurfaceDataset, total_distance_km: float) -> None:
    """Print grouped distance totals for Asphalt, Gravel, and Unknown."""
    summary = dataset.summary
    print("Surface summary:")
    print(f"Road:    {summary.road_km:.1f} km ({round(summary.road_pct(total_distance_km))}%)")
    print(f"Gravel:  {summary.gravel_km:.1f} km ({round(summary.gravel_pct(total_distance_km))}%)")
    print(f"Trail:   {summary.trail_km:.1f} km ({round(summary.trail_pct(total_distance_km))}%)")
    print(f"Unknown: {summary.unknown_km:.1f} km ({round(summary.unknown_pct(total_distance_km))}%)")


def print_unknown_segments(dataset: SurfaceDataset) -> None:
    """Print segments with missing OSM surface data for manual inspection."""
    print()
    print("Unknown segments (missing OSM surface data):")

    if not dataset.unknown_segments:
        print("None")
        return

    header = (
        f"{'Start km':>9}  {'End km':>8}  {'Length':>8}  "
        f"{'Start Lat':>10}  {'Start Lon':>10}  {'End Lat':>10}  {'End Lon':>10}"
    )
    print(header)
    print("-" * len(header))

    for segment in dataset.unknown_segments:
        print(
            f"{segment.start_km:>9.2f}  "
            f"{segment.end_km:>8.2f}  "
            f"{segment.length_km:>8.2f}  "
            f"{segment.start_lat:>10.5f}  "
            f"{segment.start_lon:>10.5f}  "
            f"{segment.end_lat:>10.5f}  "
            f"{segment.end_lon:>10.5f}"
        )
