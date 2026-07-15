"""POI category definitions, priorities, and OSM tag mapping rules."""

from dataclasses import dataclass
from enum import IntEnum
from typing import Final

from poi_profile import (
    DINING_CATEGORIES,
    PoiPlanningProfile,
    DEFAULT_ULTRA_POI_PROFILE,
    profile_includes_category,
    profile_includes_dining,
)
from supermarket_ranking import classify_supermarket_category


class PoiPriority(IntEnum):
    """POI importance for ultra-cycling roadbook planning."""

    FOOD_WATER = 1
    DINING = 2
    EMERGENCY = 3


@dataclass(frozen=True)
class PoiTagRule:
    """Maps one OSM tag combination to a POI category label."""

    category: str
    tag_key: str
    tag_value: str
    priority: PoiPriority
    profile_key: str | None = None


# Ordered rules used to classify POIs from raw OSM tags.
POI_TAG_RULES: Final[tuple[PoiTagRule, ...]] = (
    PoiTagRule("Mini supermarket", "shop", "convenience", PoiPriority.FOOD_WATER, "mini_supermarkets"),
    PoiTagRule("Supermarket", "shop", "supermarket", PoiPriority.FOOD_WATER, "small_supermarkets"),
    PoiTagRule("Drinking water", "amenity", "drinking_water", PoiPriority.FOOD_WATER, "drinking_water"),
    PoiTagRule("Drinking water", "man_made", "water_tap", PoiPriority.FOOD_WATER, "drinking_water"),
    PoiTagRule("Gas station", "amenity", "fuel", PoiPriority.FOOD_WATER, "gas_stations"),
    PoiTagRule("Bakery", "shop", "bakery", PoiPriority.FOOD_WATER, "bakeries"),
    PoiTagRule("Café", "amenity", "cafe", PoiPriority.DINING, "cafes"),
    PoiTagRule("Restaurant", "amenity", "restaurant", PoiPriority.DINING, "restaurants"),
    PoiTagRule("Fast food", "amenity", "fast_food", PoiPriority.DINING, "fast_food"),
    PoiTagRule("Bike shop", "shop", "bicycle", PoiPriority.EMERGENCY, "bike_shops"),
    PoiTagRule("Pharmacy", "amenity", "pharmacy", PoiPriority.EMERGENCY, "pharmacies"),
    PoiTagRule("ATM", "amenity", "atm", PoiPriority.EMERGENCY, "atms"),
)

_DECATHLON_SHOPS = frozenset({"sports", "outdoor", "department_store"})


def _decathlon_match(tags: dict[str, str]) -> bool:
    brand = tags.get("brand", "")
    if brand.lower() != "decathlon":
        return False
    return tags.get("shop") in _DECATHLON_SHOPS


def _rule_enabled(rule: PoiTagRule, profile: PoiPlanningProfile) -> bool:
    if rule.profile_key is None:
        return False
    return bool(getattr(profile, rule.profile_key))


def category_from_tags(
    tags: dict[str, str],
    *,
    profile: PoiPlanningProfile = DEFAULT_ULTRA_POI_PROFILE,
) -> tuple[str, PoiPriority] | None:
    """Return category and priority for the first matching active POI rule."""
    if profile.bike_shops and _decathlon_match(tags):
        return ("Decathlon", PoiPriority.EMERGENCY)

    for rule in POI_TAG_RULES:
        if tags.get(rule.tag_key) != rule.tag_value:
            continue
        if not _rule_enabled(rule, profile):
            continue

        category = rule.category
        if rule.tag_key == "shop" and rule.tag_value == "supermarket":
            category = classify_supermarket_category(tags)

        if not profile_includes_category(profile, category):
            continue

        return (category, rule.priority)

    return None


def active_overpass_filters(profile: PoiPlanningProfile = DEFAULT_ULTRA_POI_PROFILE) -> tuple[str, ...]:
    """Build Overpass filters for all currently active POI categories."""
    filters: list[str] = []
    seen: set[tuple[str, str]] = set()

    include_dining = profile_includes_dining(profile) or profile.dining_fallback_enabled

    for rule in POI_TAG_RULES:
        if not _rule_enabled(rule, profile):
            continue
        if rule.priority == PoiPriority.DINING and not include_dining:
            continue

        tag_pair = (rule.tag_key, rule.tag_value)
        if tag_pair in seen:
            continue
        seen.add(tag_pair)

        filters.append(f'node["{rule.tag_key}"="{rule.tag_value}"]')
        filters.append(f'way["{rule.tag_key}"="{rule.tag_value}"]')

    if profile.bike_shops:
        filters.extend(
            (
                'node["brand"="Decathlon"]',
                'way["brand"="Decathlon"]',
            )
        )

    return tuple(filters)


def is_dining_category(category: str) -> bool:
    return category in DINING_CATEGORIES


@dataclass(frozen=True)
class PointOfInterest:
    """One point of interest near the route."""

    osm_id: int
    osm_type: str
    name: str | None
    category: str
    priority: int
    lat: float
    lon: float
    distance_along_km: float
    distance_off_route_m: float
    tags: dict[str, str]
    opening_hours: str | None
    brand: str | None


@dataclass(frozen=True)
class PoiDataset:
    """All POIs extracted for one route."""

    pois: list[PointOfInterest]
    osm_load_s: float = 0.0
    matching_s: float = 0.0
    osm_downloaded: bool = False
    discarded: tuple = ()  # tuple[PoiDetectionDiscard, ...] — filled by poi_detector
