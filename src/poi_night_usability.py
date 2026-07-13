"""Night usability and water-fountain classification for POIs."""

from poi_types import PointOfInterest

NIGHT_USUALLY_AVAILABLE = "usually_available"
NIGHT_USUALLY_CLOSED = "usually_closed"
NIGHT_DEPENDS_ON_HOURS = "depends_on_hours"
NIGHT_ACCESS_UNCERTAIN = "access_uncertain"
NIGHT_UNKNOWN = "unknown"

WATER_PUBLIC_STREET = "public_street"
WATER_PARK = "park"
WATER_PRIVATE_UNCERTAIN = "private_uncertain"
WATER_UNKNOWN = "unknown"

_NIGHT_LABELS = {
    NIGHT_USUALLY_AVAILABLE: "Usually available",
    NIGHT_USUALLY_CLOSED: "Usually closed",
    NIGHT_DEPENDS_ON_HOURS: "Depends on opening hours",
    NIGHT_ACCESS_UNCERTAIN: "Access uncertain",
    NIGHT_UNKNOWN: "Unknown",
}

_WATER_LABELS = {
    WATER_PUBLIC_STREET: "Public street fountain",
    WATER_PARK: "Park fountain",
    WATER_PRIVATE_UNCERTAIN: "Private / uncertain fountain",
    WATER_UNKNOWN: "Unknown fountain",
}


def _is_24_hours(opening_hours: str | None) -> bool:
    if not opening_hours:
        return False
    normalized = opening_hours.lower()
    return "24/7" in normalized or normalized.startswith("24")


def classify_water_fountain_type(tags: dict[str, str]) -> str:
    """Classify drinking-water access context from preserved OSM tags."""
    access = tags.get("access", "").lower()
    if access in {"private", "no"}:
        return WATER_PRIVATE_UNCERTAIN

    if tags.get("leisure") in {"park", "garden", "playground"}:
        return WATER_PARK
    if tags.get("landuse") in {"recreation_ground", "grass", "forest"}:
        return WATER_PARK

    name = tags.get("name", "").lower()
    if "parc" in name or "park" in name or "jard" in name:
        return WATER_PARK

    if tags.get("man_made") == "water_tap":
        return WATER_PUBLIC_STREET

    if tags.get("location") in {"street", "roadside"}:
        return WATER_PUBLIC_STREET

    if tags.get("amenity") == "drinking_water" and tags.get("fountain") == "bubbler":
        return WATER_PUBLIC_STREET

    if tags.get("amenity") == "drinking_water":
        return WATER_UNKNOWN

    return WATER_UNKNOWN


def classify_night_usability(poi: PointOfInterest) -> tuple[str, str | None]:
    """
    Estimate whether a POI is realistically useful at night.

    Returns (night_usability_key, water_fountain_type_or_none).
    """
    opening_hours = poi.opening_hours
    category = poi.category

    if category == "Gas station":
        return NIGHT_USUALLY_AVAILABLE, None

    if category == "Supermarket":
        if _is_24_hours(opening_hours):
            return NIGHT_USUALLY_AVAILABLE, None
        return NIGHT_USUALLY_CLOSED, None

    if category == "Mini supermarket":
        if _is_24_hours(opening_hours):
            return NIGHT_USUALLY_AVAILABLE, None
        return NIGHT_DEPENDS_ON_HOURS, None

    if category == "Bakery":
        return NIGHT_USUALLY_CLOSED, None

    if category == "Drinking water":
        water_type = classify_water_fountain_type(poi.tags)
        if water_type == WATER_PUBLIC_STREET:
            return NIGHT_USUALLY_AVAILABLE, water_type
        if water_type == WATER_PARK:
            return NIGHT_ACCESS_UNCERTAIN, water_type
        if water_type == WATER_PRIVATE_UNCERTAIN:
            return NIGHT_ACCESS_UNCERTAIN, water_type
        return NIGHT_ACCESS_UNCERTAIN, water_type

    if category in {"Café", "Restaurant", "Fast food"}:
        if _is_24_hours(opening_hours):
            return NIGHT_USUALLY_AVAILABLE, None
        if opening_hours:
            return NIGHT_DEPENDS_ON_HOURS, None
        return NIGHT_USUALLY_CLOSED, None

    return NIGHT_UNKNOWN, None


def night_usability_label(key: str) -> str:
    return _NIGHT_LABELS.get(key, key)


def water_fountain_type_label(key: str | None) -> str | None:
    if key is None:
        return None
    return _WATER_LABELS.get(key, key)


def is_useful_at_night(night_usability: str) -> bool:
    """Return True when a POI is likely useful during night planning."""
    return night_usability in {NIGHT_USUALLY_AVAILABLE, NIGHT_DEPENDS_ON_HOURS}
