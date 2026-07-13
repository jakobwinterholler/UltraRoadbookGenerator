"""Surface pipeline diagnostics for Verify and performance reporting."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from surface_detector import PointSurfaceRecord, SurfaceRuntimeReport
from surface_types import RiderCategory, SurfaceSource


@dataclass(frozen=True)
class SurfaceDiagnostics:
    """Post-analysis surface quality and timing breakdown."""

    total_points: int
    unknown_by_cause: dict[str, int]
    source_counts: dict[str, int]
    category_km: dict[str, float]
    top_unmapped_tags: list[tuple[str, int]]
    runtime: SurfaceRuntimeReport
    inference_s: float
    simplify_s: float
    decimation_factor: int
    osm_segment_count_raw: int
    osm_segment_count_indexed: int
    avg_candidates_per_point: float

    def to_dict(self) -> dict:
        return {
            "total_points": self.total_points,
            "unknown_by_cause": self.unknown_by_cause,
            "source_counts": self.source_counts,
            "category_km": self.category_km,
            "top_unmapped_tags": [
                {"tag": tag, "point_count": count} for tag, count in self.top_unmapped_tags
            ],
            "runtime": {
                "osm_load_s": self.runtime.osm_load_s,
                "json_parse_s": self.runtime.json_parse_s,
                "simplify_s": self.simplify_s,
                "index_build_s": self.runtime.index_build_s,
                "matching_s": self.runtime.matching_s,
                "inference_s": self.inference_s,
                "merge_s": self.runtime.merge_s,
                "total_s": self.runtime.total_s,
            },
            "decimation_factor": self.decimation_factor,
            "osm_segment_count_raw": self.osm_segment_count_raw,
            "osm_segment_count_indexed": self.osm_segment_count_indexed,
            "avg_candidates_per_point": self.avg_candidates_per_point,
        }


def build_surface_diagnostics(
    points: list[PointSurfaceRecord],
    runtime: SurfaceRuntimeReport,
    *,
    inference_s: float,
    simplify_s: float,
    decimation_factor: int,
    osm_segment_count_raw: int,
    osm_segment_count_indexed: int,
    avg_candidates_per_point: float,
) -> SurfaceDiagnostics:
    unknown_by_cause: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    category_km: Counter[str] = Counter()
    unmapped_tags: Counter[str] = Counter()

    for index, point in enumerate(points):
        if index == 0:
            continue
        span_km = max(0.0, point.distance_km - points[index - 1].distance_km)
        category_km[point.resolved.rider_category.value] += span_km
        source_counts[point.resolved.surface_source.value] += 1

        if point.resolved.rider_category == RiderCategory.UNKNOWN:
            if not point.matched:
                unknown_by_cause["unmatched"] += 1
            elif point.osm_surface is None:
                unknown_by_cause["no_surface_tag"] += 1
            elif point.resolved.surface_source == SurfaceSource.OSM_TAG:
                unknown_by_cause["unmapped_osm_tag"] += 1
                unmapped_tags[point.osm_surface] += 1
            else:
                unknown_by_cause["insufficient_evidence"] += 1

    return SurfaceDiagnostics(
        total_points=len(points),
        unknown_by_cause=dict(unknown_by_cause),
        source_counts=dict(source_counts),
        category_km={key: round(value, 2) for key, value in category_km.items()},
        top_unmapped_tags=unmapped_tags.most_common(10),
        runtime=runtime,
        inference_s=round(inference_s, 3),
        simplify_s=round(simplify_s, 3),
        decimation_factor=decimation_factor,
        osm_segment_count_raw=osm_segment_count_raw,
        osm_segment_count_indexed=osm_segment_count_indexed,
        avg_candidates_per_point=avg_candidates_per_point,
    )
