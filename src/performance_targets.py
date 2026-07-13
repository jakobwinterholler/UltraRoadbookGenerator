"""Performance targets and cache-mode classification for route analysis."""

from __future__ import annotations

from dataclasses import dataclass

# Targets for 800+ km ultra routes (same analysis quality).
TARGET_COLD_ANALYSIS_S = 90.0
TARGET_WARM_ANALYSIS_S = 30.0

CACHE_MODE_COLD = "cold"
CACHE_MODE_WARM = "warm"
CACHE_MODE_HOT = "hot"


@dataclass(frozen=True)
class PerformanceSummary:
    """High-level performance outcome for one analysis run."""

    cache_mode: str
    total_s: float
    memory_peak_mb: float
    target_cold_s: float
    target_warm_s: float
    meets_cold_target: bool
    meets_warm_target: bool
    surface_cache_hit: bool
    poi_cache_hit: bool
    processed_geometry_hit: bool


def classify_cache_mode(
    *,
    surface_downloaded: bool,
    poi_downloaded: bool,
    processed_geometry_hit: bool,
) -> str:
    """
    Classify analysis cache warmth.

    hot  — processed OSM geometry reused (skip parse/index rebuild)
    warm — raw OSM cache hit, geometry rebuilt
    cold — Overpass download required
    """
    if processed_geometry_hit:
        return CACHE_MODE_HOT
    if not surface_downloaded and not poi_downloaded:
        return CACHE_MODE_WARM
    if surface_downloaded or poi_downloaded:
        return CACHE_MODE_COLD
    return CACHE_MODE_WARM


def build_performance_summary(
    *,
    cache_mode: str,
    total_s: float,
    memory_peak_mb: float,
    surface_cache_hit: bool,
    poi_cache_hit: bool,
    processed_geometry_hit: bool,
) -> PerformanceSummary:
    warm_target = cache_mode in {CACHE_MODE_WARM, CACHE_MODE_HOT}
    return PerformanceSummary(
        cache_mode=cache_mode,
        total_s=round(total_s, 1),
        memory_peak_mb=round(memory_peak_mb, 1),
        target_cold_s=TARGET_COLD_ANALYSIS_S,
        target_warm_s=TARGET_WARM_ANALYSIS_S,
        meets_cold_target=total_s <= TARGET_COLD_ANALYSIS_S,
        meets_warm_target=warm_target and total_s <= TARGET_WARM_ANALYSIS_S,
        surface_cache_hit=surface_cache_hit,
        poi_cache_hit=poi_cache_hit,
        processed_geometry_hit=processed_geometry_hit,
    )
