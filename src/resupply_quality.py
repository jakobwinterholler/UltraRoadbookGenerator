"""Resupply quality bands along the route for map overlays."""

from dataclasses import dataclass

from gpx_parser import TrackPoint
from resupply_quality_config import (
    DEFAULT_RESUPPLY_QUALITY_CONFIG,
    QUALITY_COLORS,
    QUALITY_EMOJIS,
    QUALITY_LABELS,
    ResupplyQualityConfig,
)
from resupply_zones import ResupplyZone, ZoneCategoryGroup


@dataclass(frozen=True)
class ResupplyQualitySegment:
    """One colored segment for the resupply-quality overlay."""

    start_km: float
    end_km: float
    quality: str
    label: str
    emoji: str
    color: str
    distance_to_next_zone_km: float | None


def _category_primary_score(group: ZoneCategoryGroup | None) -> float | None:
    if group is None or group.primary is None:
        return None
    return group.primary.score


def _zone_category_map(zone: ResupplyZone) -> dict[str, ZoneCategoryGroup]:
    return {group.key: group for group in zone.categories}


def _zone_has_reliable_food(zone: ResupplyZone, config: ResupplyQualityConfig) -> bool:
    food = _zone_category_map(zone).get("food")
    score = _category_primary_score(food)
    return score is not None and score >= config.reliable_food_score


def _zone_has_reliable_water(zone: ResupplyZone, config: ResupplyQualityConfig) -> bool:
    water = _zone_category_map(zone).get("water")
    score = _category_primary_score(water)
    return score is not None and score >= config.reliable_water_score


def _zone_has_any_option(zone: ResupplyZone) -> bool:
    return any(group.primary is not None for group in zone.categories)


def _classify_quality(
    distance_to_next_km: float | None,
    next_zone: ResupplyZone | None,
    config: ResupplyQualityConfig,
) -> str:
    if next_zone is None:
        return "poor"

    if distance_to_next_km is None:
        return "poor"

    has_food = _zone_has_reliable_food(next_zone, config)
    has_water = _zone_has_reliable_water(next_zone, config)
    has_any = _zone_has_any_option(next_zone)

    if distance_to_next_km <= config.excellent_max_km and has_food and has_water:
        return "excellent"
    if distance_to_next_km <= config.good_max_km and (has_food or has_water):
        return "good"
    if distance_to_next_km <= config.limited_max_km and has_any:
        return "limited"
    return "poor"


def _next_zone_after(
    km: float,
    zones: list[ResupplyZone],
) -> tuple[ResupplyZone | None, float | None]:
    for zone in zones:
        if zone.distance_along_km > km:
            return zone, zone.distance_along_km - km
    return None, None


def build_resupply_quality_segments(
    track: list[TrackPoint],
    zones: list[ResupplyZone],
    *,
    config: ResupplyQualityConfig = DEFAULT_RESUPPLY_QUALITY_CONFIG,
) -> list[ResupplyQualitySegment]:
    """Build colored resupply-quality segments from track points and zones."""
    if not track:
        return []

    ordered_zones = sorted(zones, key=lambda zone: zone.distance_along_km)
    point_qualities: list[tuple[float, str, float | None]] = []

    for point in track:
        next_zone, distance_km = _next_zone_after(point.distance_km, ordered_zones)
        quality = _classify_quality(distance_km, next_zone, config)
        point_qualities.append((point.distance_km, quality, distance_km))

    segments: list[ResupplyQualitySegment] = []
    segment_start_km = point_qualities[0][0]
    current_quality = point_qualities[0][1]
    current_distance = point_qualities[0][2]

    for distance_km, quality, distance_to_next in point_qualities[1:]:
        if quality != current_quality:
            segments.append(
                ResupplyQualitySegment(
                    start_km=round(segment_start_km, 3),
                    end_km=round(distance_km, 3),
                    quality=current_quality,
                    label=QUALITY_LABELS[current_quality],
                    emoji=QUALITY_EMOJIS[current_quality],
                    color=QUALITY_COLORS[current_quality],
                    distance_to_next_zone_km=round(current_distance, 2)
                    if current_distance is not None
                    else None,
                )
            )
            segment_start_km = distance_km
            current_quality = quality
            current_distance = distance_to_next

    segments.append(
        ResupplyQualitySegment(
            start_km=round(segment_start_km, 3),
            end_km=round(point_qualities[-1][0], 3),
            quality=current_quality,
            label=QUALITY_LABELS[current_quality],
            emoji=QUALITY_EMOJIS[current_quality],
            color=QUALITY_COLORS[current_quality],
            distance_to_next_zone_km=round(current_distance, 2)
            if current_distance is not None
            else None,
        )
    )

    return segments
