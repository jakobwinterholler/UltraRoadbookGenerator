"""Spatial clustering of POIs into resupply zones."""

import math
from collections import defaultdict
from dataclasses import dataclass

from poi_contact import extract_phone, extract_website
from poi_detour import DetourBand, classify_detour
from gas_station_shop import assess_fuel_shop
from poi_night_usability import classify_night_usability, night_usability_label, water_fountain_type_label
from poi_reviews import PoiReviews, empty_reviews
from poi_scoring import DEFAULT_POI_SCORE_WEIGHTS, PoiScoreWeights, score_poi
from poi_types import PointOfInterest
from resupply_zone_config import (
    DEFAULT_RESUPPLY_ZONE_CONFIG,
    DINING_POI_CATEGORIES,
    FOOD_POI_CATEGORIES,
    FUEL_POI_CATEGORIES,
    RESUPPLY_CATEGORY_KEYS,
    SOLO_ZONE_CATEGORIES,
    WATER_POI_CATEGORIES,
    ResupplyZoneConfig,
)

_METERS_PER_DEG_LAT = 110_540.0


@dataclass(frozen=True)
class ZonePoiOption:
    """One POI option inside a resupply zone category."""

    osm_id: int
    osm_type: str
    name: str | None
    poi_category: str
    distance_along_km: float
    distance_off_route_m: float
    accessibility_label: str
    accessibility_emoji: str
    accessibility_tone: str
    score: float
    brand: str | None
    lat: float
    lon: float
    night_usability: str
    night_usability_label: str
    water_fountain_type: str | None
    water_fountain_type_label: str | None
    opening_hours: str | None
    phone: str | None
    website: str | None
    tags: dict[str, str]
    reviews: PoiReviews
    fuel_shop_confidence: str | None = None
    fuel_shop_label: str | None = None


@dataclass(frozen=True)
class ZoneCategoryGroup:
    """Primary and alternative POIs for one rider-facing category."""

    key: str
    label: str
    primary: ZonePoiOption | None
    alternatives: list[ZonePoiOption]


@dataclass(frozen=True)
class ResupplyZone:
    """One spatial resupply stop along the route."""

    zone_id: int
    name: str
    lat: float
    lon: float
    distance_along_km: float
    distance_off_route_m: float
    accessibility_label: str
    accessibility_emoji: str
    accessibility_tone: str
    poi_count: int
    categories: tuple[ZoneCategoryGroup, ...]


@dataclass(frozen=True)
class ResupplyZonePlan:
    """Complete resupply zone output for one route."""

    zones: list[ResupplyZone]
    poi_zone_ids: dict[tuple[int, str], int]


def _meters_per_deg_lon(lat_deg: float) -> float:
    return 111_320.0 * math.cos(math.radians(lat_deg))


def _distance_m(
    lat_a: float,
    lon_a: float,
    lat_b: float,
    lon_b: float,
) -> float:
    mean_lat = (lat_a + lat_b) / 2.0
    meters_lon = _meters_per_deg_lon(mean_lat)
    dx = (lon_b - lon_a) * meters_lon
    dy = (lat_b - lat_a) * _METERS_PER_DEG_LAT
    return math.hypot(dx, dy)


class _UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))

    def find(self, index: int) -> int:
        while self.parent[index] != index:
            self.parent[index] = self.parent[self.parent[index]]
            index = self.parent[index]
        return index

    def union(self, left: int, right: int) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def _grid_key(lat: float, lon: float, cell_lat_deg: float, cell_lon_deg: float) -> tuple[int, int]:
    return (int(lat / cell_lat_deg), int(lon / cell_lon_deg))


def _cluster_along_route_spread_km(cluster: list[PointOfInterest]) -> float:
    if len(cluster) < 2:
        return 0.0
    distances = [poi.distance_along_km for poi in cluster]
    return max(distances) - min(distances)


def _split_along_route_clusters(
    clusters: list[list[PointOfInterest]],
    config: ResupplyZoneConfig,
) -> list[list[PointOfInterest]]:
    """Split clusters whose POIs span too much distance along the route."""
    max_spread_km = config.max_along_route_spread_km
    result: list[list[PointOfInterest]] = []

    for cluster in clusters:
        if len(cluster) < 2 or _cluster_along_route_spread_km(cluster) <= max_spread_km:
            result.append(cluster)
            continue

        sorted_cluster = sorted(cluster, key=lambda poi: poi.distance_along_km)
        current: list[PointOfInterest] = [sorted_cluster[0]]
        anchor_km = sorted_cluster[0].distance_along_km

        for poi in sorted_cluster[1:]:
            if poi.distance_along_km - anchor_km <= max_spread_km:
                current.append(poi)
            else:
                result.append(current)
                current = [poi]
                anchor_km = poi.distance_along_km

        if current:
            result.append(current)

    return result


def _spatial_cluster(
    pois: list[PointOfInterest],
    config: ResupplyZoneConfig,
) -> list[list[PointOfInterest]]:
    """Merge POIs into candidate zones using physical proximity."""
    if not pois:
        return []

    merge_radius_m = config.merge_radius_m
    max_along_km = config.max_along_route_spread_km
    mean_lat = sum(poi.lat for poi in pois) / len(pois)
    cell_lat_deg = merge_radius_m / _METERS_PER_DEG_LAT
    cell_lon_deg = merge_radius_m / _meters_per_deg_lon(mean_lat)

    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for index, poi in enumerate(pois):
        grid[_grid_key(poi.lat, poi.lon, cell_lat_deg, cell_lon_deg)].append(index)

    union_find = _UnionFind(len(pois))
    for index, poi in enumerate(pois):
        cell_y, cell_x = _grid_key(poi.lat, poi.lon, cell_lat_deg, cell_lon_deg)
        for delta_y in (-1, 0, 1):
            for delta_x in (-1, 0, 1):
                for neighbor_index in grid.get((cell_y + delta_y, cell_x + delta_x), []):
                    if neighbor_index <= index:
                        continue
                    neighbor = pois[neighbor_index]
                    if _distance_m(poi.lat, poi.lon, neighbor.lat, neighbor.lon) > merge_radius_m:
                        continue
                    along_gap_km = abs(poi.distance_along_km - neighbor.distance_along_km)
                    if along_gap_km > max_along_km:
                        continue
                    union_find.union(index, neighbor_index)

    grouped: dict[int, list[PointOfInterest]] = defaultdict(list)
    for index, poi in enumerate(pois):
        grouped[union_find.find(index)].append(poi)

    return list(grouped.values())


def _cluster_diameter_m(cluster: list[PointOfInterest]) -> float:
    max_distance = 0.0
    for left_index, left in enumerate(cluster):
        for right in cluster[left_index + 1 :]:
            max_distance = max(
                max_distance,
                _distance_m(left.lat, left.lon, right.lat, right.lon),
            )
    return max_distance


def _cluster_centroid(cluster: list[PointOfInterest]) -> tuple[float, float]:
    return (
        sum(poi.lat for poi in cluster) / len(cluster),
        sum(poi.lon for poi in cluster) / len(cluster),
    )


def _split_cluster(cluster: list[PointOfInterest]) -> list[list[PointOfInterest]]:
    """Split one oversized cluster into two spatial sub-clusters."""
    if len(cluster) < 2:
        return [cluster]

    farthest_poi = max(
        cluster,
        key=lambda poi: _distance_m(cluster[0].lat, cluster[0].lon, poi.lat, poi.lon),
    )
    center_a = (cluster[0].lat, cluster[0].lon)
    center_b = (farthest_poi.lat, farthest_poi.lon)

    for _ in range(12):
        group_a: list[PointOfInterest] = []
        group_b: list[PointOfInterest] = []
        for poi in cluster:
            if _distance_m(poi.lat, poi.lon, center_a[0], center_a[1]) <= _distance_m(
                poi.lat, poi.lon, center_b[0], center_b[1]
            ):
                group_a.append(poi)
            else:
                group_b.append(poi)

        if not group_a or not group_b:
            return [cluster]

        center_a = _cluster_centroid(group_a)
        center_b = _cluster_centroid(group_b)

    separation_m = _distance_m(center_a[0], center_a[1], center_b[0], center_b[1])
    if separation_m < DEFAULT_RESUPPLY_ZONE_CONFIG.split_subcenter_separation_m:
        return [cluster]

    return [group_a, group_b]


def _split_oversized_clusters(
    clusters: list[list[PointOfInterest]],
    config: ResupplyZoneConfig,
    depth: int = 0,
) -> list[list[PointOfInterest]]:
    """Recursively split clusters that are too large geographically."""
    result: list[list[PointOfInterest]] = []

    for cluster in clusters:
        if (
            len(cluster) > 1
            and _cluster_diameter_m(cluster) > config.max_zone_diameter_m
            and depth < config.max_split_depth
        ):
            for sub_cluster in _split_cluster(cluster):
                result.extend(
                    _split_oversized_clusters([sub_cluster], config, depth + 1)
                )
        else:
            result.append(cluster)

    return result


def _cluster_has_resupply_value(cluster: list[PointOfInterest]) -> bool:
    return any(
        poi.category in FOOD_POI_CATEGORIES
        or poi.category in WATER_POI_CATEGORIES
        or poi.category in FUEL_POI_CATEGORIES
        for poi in cluster
    )


def _is_solo_zone(cluster: list[PointOfInterest]) -> bool:
    if len(cluster) != 1:
        return False
    return cluster[0].category in SOLO_ZONE_CATEGORIES


def _is_attachable_orphan(poi: PointOfInterest) -> bool:
    return poi.category == "Drinking water" and not poi.name and not poi.brand


def _nearest_cluster_index(
    poi: PointOfInterest,
    clusters: list[list[PointOfInterest]],
) -> tuple[int, float]:
    best_index = -1
    best_distance = float("inf")
    for index, cluster in enumerate(clusters):
        for candidate in cluster:
            distance = _distance_m(poi.lat, poi.lon, candidate.lat, candidate.lon)
            if distance < best_distance:
                best_distance = distance
                best_index = index
    return best_index, best_distance


def _finalize_clusters(
    clusters: list[list[PointOfInterest]],
    config: ResupplyZoneConfig,
) -> list[list[PointOfInterest]]:
    """Apply solo-zone, orphan-attach, and dining-only filtering rules."""
    kept: list[list[PointOfInterest]] = []
    orphans: list[PointOfInterest] = []

    for cluster in clusters:
        if _cluster_has_resupply_value(cluster):
            kept.append(cluster)
            continue
        if _is_solo_zone(cluster):
            kept.append(cluster)
            continue
        if len(cluster) == 1:
            orphans.append(cluster[0])
            continue
        if all(poi.category in DINING_POI_CATEGORIES for poi in cluster):
            named = [poi for poi in cluster if poi.name]
            if len(cluster) >= 2 or named:
                orphans.extend(cluster)
            continue
        orphans.extend(cluster)

    for orphan in orphans:
        if not _is_attachable_orphan(orphan):
            continue
        nearest_index, distance_m = _nearest_cluster_index(orphan, kept)
        if nearest_index >= 0 and distance_m <= config.attach_orphan_radius_m:
            kept[nearest_index].append(orphan)

    return kept


def _poi_option(
    poi: PointOfInterest,
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None = None,
) -> ZonePoiOption:
    band: DetourBand = classify_detour(poi.distance_off_route_m)
    night_usability, water_type = classify_night_usability(poi)
    cached_score = score_cache.get((poi.osm_id, poi.osm_type)) if score_cache else None
    resolved_score = cached_score if cached_score is not None else score_poi(poi, weights)
    shop_assessment = assess_fuel_shop(
        category=poi.category,
        tags=poi.tags,
        name=poi.name,
        brand=poi.brand,
    )
    return ZonePoiOption(
        osm_id=poi.osm_id,
        osm_type=poi.osm_type,
        name=poi.name,
        poi_category=poi.category,
        distance_along_km=poi.distance_along_km,
        distance_off_route_m=poi.distance_off_route_m,
        accessibility_label=band.label,
        accessibility_emoji=band.emoji,
        accessibility_tone=band.tone,
        score=resolved_score,
        brand=poi.brand,
        lat=poi.lat,
        lon=poi.lon,
        night_usability=night_usability,
        night_usability_label=night_usability_label(night_usability),
        water_fountain_type=water_type,
        water_fountain_type_label=water_fountain_type_label(water_type),
        opening_hours=poi.opening_hours,
        phone=extract_phone(poi.tags),
        website=extract_website(poi.tags),
        tags=poi.tags,
        reviews=empty_reviews(),
        fuel_shop_confidence=shop_assessment.confidence if shop_assessment else None,
        fuel_shop_label=shop_assessment.label if shop_assessment else None,
    )


def _category_group(
    key: str,
    label: str,
    members: list[PointOfInterest],
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None = None,
) -> ZoneCategoryGroup | None:
    if not members:
        return None

    ranked = sorted(
        members,
        key=lambda poi: score_cache.get((poi.osm_id, poi.osm_type), score_poi(poi, weights))
        if score_cache
        else score_poi(poi, weights),
        reverse=True,
    )
    primary = _poi_option(ranked[0], weights, score_cache)
    alternatives = [_poi_option(poi, weights, score_cache) for poi in ranked[1:]]
    return ZoneCategoryGroup(
        key=key,
        label=label,
        primary=primary,
        alternatives=alternatives,
    )


def _zone_name(distance_along_km: float) -> str:
    return f"KM {int(round(distance_along_km))}"


def _build_zone(
    zone_id: int,
    cluster: list[PointOfInterest],
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None = None,
) -> ResupplyZone:
    distance_along_km = sum(poi.distance_along_km for poi in cluster) / len(cluster)
    distance_off_route_m = sum(poi.distance_off_route_m for poi in cluster) / len(cluster)
    centroid_lat, centroid_lon = _cluster_centroid(cluster)
    zone_band = classify_detour(distance_off_route_m)

    category_groups: list[ZoneCategoryGroup] = []
    for key, label, members in RESUPPLY_CATEGORY_KEYS:
        grouped_members = [poi for poi in cluster if poi.category in members]
        group = _category_group(key, label, grouped_members, weights, score_cache)
        if group is not None:
            category_groups.append(group)

    return ResupplyZone(
        zone_id=zone_id,
        name=_zone_name(distance_along_km),
        lat=round(centroid_lat, 6),
        lon=round(centroid_lon, 6),
        distance_along_km=round(distance_along_km, 2),
        distance_off_route_m=round(distance_off_route_m, 0),
        accessibility_label=zone_band.label,
        accessibility_emoji=zone_band.emoji,
        accessibility_tone=zone_band.tone,
        poi_count=len(cluster),
        categories=tuple(category_groups),
    )


def build_resupply_zones(
    pois: list[PointOfInterest],
    *,
    config: ResupplyZoneConfig = DEFAULT_RESUPPLY_ZONE_CONFIG,
    weights: PoiScoreWeights = DEFAULT_POI_SCORE_WEIGHTS,
    score_cache: dict[tuple[int, str], float] | None = None,
) -> ResupplyZonePlan:
    """
    Cluster POIs into resupply zones and select one primary per category.
    """
    if not pois:
        return ResupplyZonePlan(zones=[], poi_zone_ids={})

    merged = _spatial_cluster(pois, config)
    along_split = _split_along_route_clusters(merged, config)
    split = _split_oversized_clusters(along_split, config)
    clusters = _finalize_clusters(split, config)

    zones: list[ResupplyZone] = []
    poi_zone_ids: dict[tuple[int, str], int] = {}

    for zone_id, cluster in enumerate(
        sorted(clusters, key=lambda group: sum(p.distance_along_km for p in group) / len(group)),
        start=1,
    ):
        zone = _build_zone(zone_id, cluster, weights, score_cache)
        zones.append(zone)
        for poi in cluster:
            poi_zone_ids[(poi.osm_id, poi.osm_type)] = zone_id

    return ResupplyZonePlan(zones=zones, poi_zone_ids=poi_zone_ids)
