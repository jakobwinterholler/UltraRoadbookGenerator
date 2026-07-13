"""Configurable POI planning profiles for unsupported ultra cycling."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class PoiPlanningProfile:
    """
    Controls which POI categories are fetched, matched, and shown.

    Default profile prioritises compact food resupply for unsupported ultras.
    """

    mini_supermarkets: bool = True
    small_supermarkets: bool = True
    convenience_stores: bool = True
    gas_stations: bool = True
    drinking_water: bool = True
    bakeries: bool = True

    restaurants: bool = False
    cafes: bool = False
    fast_food: bool = False
    atms: bool = False
    pharmacies: bool = False
    bike_shops: bool = False

    # Include dining POIs when no priority-1 food source is within this gap (km).
    dining_fallback_km: float = 30.0
    dining_fallback_enabled: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict | None) -> PoiPlanningProfile:
        if not payload:
            return DEFAULT_ULTRA_POI_PROFILE

        known_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered = {key: value for key, value in payload.items() if key in known_fields}
        return cls(**filtered)


DEFAULT_ULTRA_POI_PROFILE = PoiPlanningProfile()

CATEGORY_PROFILE_KEYS: dict[str, str] = {
    "Mini supermarket": "mini_supermarkets",
    "Small supermarket": "small_supermarkets",
    "Supermarket": "small_supermarkets",
    "Gas station": "gas_stations",
    "Drinking water": "drinking_water",
    "Bakery": "bakeries",
    "Restaurant": "restaurants",
    "Café": "cafes",
    "Fast food": "fast_food",
    "ATM": "atms",
    "Pharmacy": "pharmacies",
    "Bike shop": "bike_shops",
    "Decathlon": "bike_shops",
}

DINING_CATEGORIES = frozenset({"Restaurant", "Café", "Fast food"})
FOOD_RESUPPLY_CATEGORIES = frozenset({
    "Mini supermarket",
    "Small supermarket",
    "Supermarket",
    "Bakery",
})


def profile_includes_category(profile: PoiPlanningProfile, category: str) -> bool:
    """Return whether a classified POI category is enabled in the profile."""
    if category == "Mini supermarket":
        return profile.mini_supermarkets or profile.convenience_stores
    if category == "Small supermarket":
        return profile.small_supermarkets
    if category == "Supermarket":
        return profile.small_supermarkets

    key = CATEGORY_PROFILE_KEYS.get(category)
    if key is None:
        return False
    return bool(getattr(profile, key))


def profile_includes_dining(profile: PoiPlanningProfile) -> bool:
    return profile.restaurants or profile.cafes or profile.fast_food


def profile_catalog() -> list[dict[str, str | bool | float]]:
    """Return profile fields for the frontend settings UI."""
    profile = DEFAULT_ULTRA_POI_PROFILE
    return [
        {"key": "mini_supermarkets", "label": "Mini supermarkets", "enabled": profile.mini_supermarkets, "group": "priority_1"},
        {"key": "convenience_stores", "label": "Convenience stores", "enabled": profile.convenience_stores, "group": "priority_1"},
        {"key": "small_supermarkets", "label": "Small supermarkets", "enabled": profile.small_supermarkets, "group": "priority_1"},
        {"key": "gas_stations", "label": "Gas stations", "enabled": profile.gas_stations, "group": "priority_1"},
        {"key": "drinking_water", "label": "Public drinking water", "enabled": profile.drinking_water, "group": "priority_1"},
        {"key": "bakeries", "label": "Bakeries", "enabled": profile.bakeries, "group": "priority_2"},
        {"key": "restaurants", "label": "Restaurants", "enabled": profile.restaurants, "group": "optional"},
        {"key": "cafes", "label": "Cafés", "enabled": profile.cafes, "group": "optional"},
        {"key": "fast_food", "label": "Fast food", "enabled": profile.fast_food, "group": "optional"},
        {"key": "atms", "label": "ATMs", "enabled": profile.atms, "group": "optional"},
        {"key": "pharmacies", "label": "Pharmacies", "enabled": profile.pharmacies, "group": "optional"},
        {"key": "bike_shops", "label": "Bike shops", "enabled": profile.bike_shops, "group": "optional"},
        {"key": "dining_fallback_enabled", "label": "Dining fallback in food deserts", "enabled": profile.dining_fallback_enabled, "group": "advanced"},
        {"key": "dining_fallback_km", "label": "Food desert gap (km)", "enabled": profile.dining_fallback_km, "group": "advanced"},
    ]
