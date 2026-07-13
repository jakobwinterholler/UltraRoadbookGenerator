"""Aggregate rider-facing surface categories for the Surface page."""

from dataclasses import dataclass

from route_visualization import RouteVisualization
from surface_types import RIDER_CATEGORY_COLORS, RiderCategory


@dataclass(frozen=True)
class SurfaceCategoryStat:
    rider_category: str
    label: str
    distance_km: float
    percentage: float
    color: str


@dataclass(frozen=True)
class SurfaceSubcategoryStat:
    rider_category: str
    rider_subcategory: str
    distance_km: float
    percentage: float


def build_surface_category_breakdown(
    visualization: RouteVisualization,
    total_km: float,
) -> list[SurfaceCategoryStat]:
    totals: dict[str, float] = {}

    for segment in visualization.surface_segments:
        totals[segment.rider_category] = totals.get(segment.rider_category, 0.0) + max(
            0.0,
            segment.end_km - segment.start_km,
        )

    order = [RiderCategory.ROAD, RiderCategory.GRAVEL, RiderCategory.TRAIL, RiderCategory.UNKNOWN]
    stats: list[SurfaceCategoryStat] = []
    for category in order:
        distance_km = totals.get(category.value, 0.0)
        stats.append(
            SurfaceCategoryStat(
                rider_category=category.value,
                label=category.value,
                distance_km=round(distance_km, 1),
                percentage=round((distance_km / total_km * 100) if total_km > 0 else 0.0, 1),
                color=RIDER_CATEGORY_COLORS[category],
            )
        )
    return stats


def build_surface_subcategory_breakdown(
    visualization: RouteVisualization,
    total_km: float,
) -> list[SurfaceSubcategoryStat]:
    totals: dict[tuple[str, str], float] = {}

    for segment in visualization.surface_segments:
        key = (segment.rider_category, segment.rider_subcategory)
        totals[key] = totals.get(key, 0.0) + max(0.0, segment.end_km - segment.start_km)

    stats: list[SurfaceSubcategoryStat] = []
    for (category, subcategory), distance_km in sorted(totals.items(), key=lambda item: item[1], reverse=True):
        stats.append(
            SurfaceSubcategoryStat(
                rider_category=category,
                rider_subcategory=subcategory,
                distance_km=round(distance_km, 1),
                percentage=round((distance_km / total_km * 100) if total_km > 0 else 0.0, 1),
            )
        )
    return stats
