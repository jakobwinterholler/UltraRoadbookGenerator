"""Persistent OSM caches: binary geometry store and cache path helpers."""

from __future__ import annotations

import pickle
import time
from dataclasses import dataclass
from pathlib import Path

from gpx_parser import TrackPoint
from surface_index import SpatialGridIndex
from surface_matcher import OsmWaySegment

PROCESSED_CACHE_VERSION = "processed_v2"
PROCESSED_CACHE_SUFFIX = ".geometry.pkl"
SURFACE_ALGORITHM_VERSION = "surface_v2"


@dataclass(frozen=True)
class ProcessedSurfaceGeometry:
    """Parsed and indexed OSM geometry ready for GPX matching."""

    segments: list[OsmWaySegment]
    spatial_index: SpatialGridIndex
    raw_element_count: int
    load_s: float


@dataclass(frozen=True)
class GeometryCacheStatus:
    hit: bool
    built: bool


def processed_cache_path(cache_dir: Path, gpx_path: Path) -> Path:
    return cache_dir / f"{gpx_path.stem}{PROCESSED_CACHE_SUFFIX}"


def _route_distance_km(track: list[TrackPoint]) -> float:
    return round(track[-1].distance_km, 3)


def load_processed_surface_geometry(
    cache_dir: Path,
    gpx_path: Path,
    track: list[TrackPoint],
    *,
    refresh_osm: bool = False,
) -> ProcessedSurfaceGeometry | None:
    """Load pre-parsed OSM segments and spatial index when available."""
    if refresh_osm or not track:
        return None

    cache_file = processed_cache_path(cache_dir, gpx_path)
    if not cache_file.is_file():
        return None

    started = time.perf_counter()
    try:
        with cache_file.open("rb") as handle:
            payload = pickle.load(handle)
    except (OSError, pickle.UnpicklingError, EOFError):
        return None

    if payload.get("version") != PROCESSED_CACHE_VERSION:
        return None
    if payload.get("algorithm_version") != SURFACE_ALGORITHM_VERSION:
        return None
    if payload.get("route_distance_km") != _route_distance_km(track):
        return None

    segments = payload.get("segments")
    spatial_index = payload.get("spatial_index")
    if not isinstance(segments, list) or not isinstance(spatial_index, SpatialGridIndex):
        return None

    return ProcessedSurfaceGeometry(
        segments=segments,
        spatial_index=spatial_index,
        raw_element_count=int(payload.get("raw_element_count", 0)),
        load_s=round(time.perf_counter() - started, 2),
    )


def save_processed_surface_geometry(
    cache_dir: Path,
    gpx_path: Path,
    track: list[TrackPoint],
    segments: list[OsmWaySegment],
    spatial_index: SpatialGridIndex,
    *,
    raw_element_count: int,
) -> None:
    """Persist parsed OSM geometry for fast warm re-analysis."""
    cache_file = processed_cache_path(cache_dir, gpx_path)
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": PROCESSED_CACHE_VERSION,
        "algorithm_version": SURFACE_ALGORITHM_VERSION,
        "route_distance_km": _route_distance_km(track),
        "raw_element_count": raw_element_count,
        "segments": segments,
        "spatial_index": spatial_index,
    }
    temp_file = cache_file.with_suffix(".tmp")
    with temp_file.open("wb") as handle:
        pickle.dump(payload, handle, protocol=pickle.HIGHEST_PROTOCOL)
    temp_file.replace(cache_file)


def invalidate_processed_geometry(cache_dir: Path, gpx_path: Path) -> None:
    cache_file = processed_cache_path(cache_dir, gpx_path)
    if cache_file.is_file():
        cache_file.unlink()
