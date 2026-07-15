"""Tunable settings for resupply zone clustering."""

from dataclasses import dataclass


@dataclass
class ResupplyZoneConfig:
    """
    Central configuration for resupply zone clustering.

    Adjust these values after testing on real ultra routes.
    """

    # POIs within this radius (meters) are merged into one zone.
    merge_radius_m: float = 500.0

    # Clusters larger than this diameter (meters) are split recursively.
    max_zone_diameter_m: float = 2000.0

    # Lone low-value POIs within this radius (meters) attach to the nearest zone.
    attach_orphan_radius_m: float = 1500.0

    # Minimum separation (meters) between sub-centers when splitting a cluster.
    split_subcenter_separation_m: float = 800.0

    # Maximum recursive split depth for oversized clusters.
    max_split_depth: int = 3

    # POIs further apart than this along the route (km) must not share a zone.
    # Prevents loop routes from chaining distant stops through spatial proximity.
    max_along_route_spread_km: float = 3.0


DEFAULT_RESUPPLY_ZONE_CONFIG = ResupplyZoneConfig()

# Categories that may form a standalone one-POI resupply zone.
SOLO_ZONE_CATEGORIES = frozenset({
    "Supermarket",
    "Small supermarket",
    "Mini supermarket",
    "Gas station",
    "Bakery",
})

# Rider-facing category groups.
FOOD_POI_CATEGORIES = frozenset({
    "Supermarket",
    "Small supermarket",
    "Mini supermarket",
    "Bakery",
})
WATER_POI_CATEGORIES = frozenset({"Drinking water"})
FUEL_POI_CATEGORIES = frozenset({"Gas station"})
DINING_POI_CATEGORIES = frozenset({
    "Café",
    "Restaurant",
    "Fast food",
})

RESUPPLY_CATEGORY_KEYS = (
    ("food", "Food", FOOD_POI_CATEGORIES),
    ("water", "Water", WATER_POI_CATEGORIES),
    ("fuel", "Fuel", FUEL_POI_CATEGORIES),
    ("dining", "Dining", DINING_POI_CATEGORIES),
)
