"""Parallel OSM data prefetch for the analysis pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from gpx_parser import TrackPoint
from osm_cache_store import load_processed_surface_geometry
from osm_fetch import fetch_parallel
from poi_detector import fetch_poi_osm_elements, load_poi_osm_elements
from poi_profile import PoiPlanningProfile
from surface_detector import fetch_surface_osm_elements, load_surface_osm_elements


@dataclass(frozen=True)
class OsmPrefetchResult:
    surface_elements: list[dict] | None
    poi_elements: list[dict] | None
    surface_downloaded: bool
    poi_downloaded: bool
    parallel_download_s: float


def prefetch_osm_data(
    track: list[TrackPoint],
    gpx_path: Path,
    cache_dir: Path,
    profile: PoiPlanningProfile,
    *,
    refresh_osm: bool = False,
) -> OsmPrefetchResult:
    """
    Load cached OSM data or download missing datasets in parallel.

    Returns element lists only for datasets downloaded in this call.
    Cached datasets are loaded later by the detectors from disk.
    """
    surface_cached, surface_needs_download = load_surface_osm_elements(
        track,
        cache_dir,
        gpx_path,
        refresh_osm=refresh_osm,
    )
    if load_processed_surface_geometry(cache_dir, gpx_path, track, refresh_osm=refresh_osm) is not None:
        surface_needs_download = False
    poi_cached, poi_needs_download = load_poi_osm_elements(
        track,
        cache_dir,
        gpx_path,
        profile,
        refresh_osm=refresh_osm,
    )

    if not surface_needs_download and not poi_needs_download:
        return OsmPrefetchResult(
            surface_elements=None,
            poi_elements=None,
            surface_downloaded=False,
            poi_downloaded=False,
            parallel_download_s=0.0,
        )

    jobs: list[tuple[str, object]] = []
    if surface_needs_download:
        jobs.append(
            (
                "surface",
                lambda: fetch_surface_osm_elements(track, cache_dir, gpx_path),
            )
        )
    if poi_needs_download:
        jobs.append(
            (
                "poi",
                lambda: fetch_poi_osm_elements(track, cache_dir, gpx_path, profile),
            )
        )

    import time

    started = time.perf_counter()
    results = fetch_parallel(jobs, max_workers=2)
    elapsed = round(time.perf_counter() - started, 2)

    surface_elements = results["surface"].elements if "surface" in results else None
    poi_elements = results["poi"].elements if "poi" in results else None

    return OsmPrefetchResult(
        surface_elements=surface_elements,
        poi_elements=poi_elements,
        surface_downloaded=surface_needs_download,
        poi_downloaded=poi_needs_download,
        parallel_download_s=elapsed,
    )
