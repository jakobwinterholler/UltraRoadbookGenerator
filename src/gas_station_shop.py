"""Assess whether a fuel POI likely includes a shop suitable for race resupply."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class FuelShopConfidence(StrEnum):
    CONFIRMED = "confirmed"
    LIKELY = "likely"
    UNKNOWN = "unknown"
    UNLIKELY = "unlikely"


@dataclass(frozen=True)
class FuelShopAssessment:
    confidence: FuelShopConfidence
    label: str
    score_adjustment: float


CONFIRMED_SHOP_VALUES = frozenset(
    {
        "convenience",
        "kiosk",
        "yes",
        "general",
        "supermarket",
        "variety_store",
        "newsagent",
        "bakery",
        "deli",
        "greengrocer",
        "department_store",
        "mall",
        "alcohol",
        "chemist",
        "cosmetics",
        "dairy",
        "frozen_food",
        "health_food",
        "pastry",
        "seafood",
        "tea",
        "tobacco",
        "travel_agency",
    }
)

UNLIKELY_SHOP_VALUES = frozenset({"no", "none"})

# Major Western European fuel networks where an attached shop is the norm.
LIKELY_SHOP_BRANDS = frozenset(
    {
        "repsol",
        "galp",
        "cepsa",
        "moeve",
        "bp",
        "shell",
        "total",
        "totalenergies",
        "q8",
        "petronor",
        "esso",
        "eni",
        "agip",
        "avia",
        "omv",
        "euroshell",
        "intermarché",
        "intermarche",
        "carrefour",
        "simply",
        "alcampo",
        "petrocat",
        "petrolis",
        "esclatoil",
    }
)

NAME_SHOP_HINTS = (
    " shop",
    " store",
    "express",
    "market",
    "minimarket",
    "mini market",
    " convenience",
    " spar",
    " on the run",
)

NAME_FUEL_ONLY_HINTS = (
    " fuel only",
    " pumps only",
    " unmanned",
    " sans shop",
    " solo gasolin",
)


def _normalized(value: str | None) -> str:
    return (value or "").strip().lower()


def _shop_tag_values(tags: dict[str, str]) -> list[str]:
    values: list[str] = []
    for key, raw in tags.items():
        if key == "shop" or key.startswith("shop:"):
            values.append(raw.strip().lower())
    return values


def _has_confirmed_shop_tag(tags: dict[str, str]) -> bool:
    for value in _shop_tag_values(tags):
        if value in CONFIRMED_SHOP_VALUES:
            return True
    if tags.get("kiosk", "").strip().lower() in {"yes", "true", "1"}:
        return True
    fast_food = tags.get("fast_food", "").strip().lower()
    if fast_food and fast_food not in {"no", "none"}:
        return True
    return False


def _has_unlikely_shop_tag(tags: dict[str, str]) -> bool:
    for value in _shop_tag_values(tags):
        if value in UNLIKELY_SHOP_VALUES:
            return True
    for key in ("fuel:shop", "shop:availability"):
        raw = tags.get(key, "").strip().lower()
        if raw in {"no", "none"}:
            return True
    return False


def _brand_suggests_shop(tags: dict[str, str], brand: str | None) -> bool:
    candidates = {_normalized(brand), _normalized(tags.get("brand")), _normalized(tags.get("operator"))}
    candidates.discard("")
    return any(candidate in LIKELY_SHOP_BRANDS for candidate in candidates)


def _name_suggests_shop(name: str | None, brand: str | None) -> bool:
    combined = f"{_normalized(name)} {_normalized(brand)}"
    return any(hint in combined for hint in NAME_SHOP_HINTS)


def _name_suggests_fuel_only(name: str | None) -> bool:
    normalized = _normalized(name)
    return any(hint in normalized for hint in NAME_FUEL_ONLY_HINTS)


def assess_fuel_shop(
    *,
    category: str,
    tags: dict[str, str],
    name: str | None = None,
    brand: str | None = None,
) -> FuelShopAssessment | None:
    """Return shop assessment for fuel POIs, or None for other categories."""
    if category != "Gas station":
        return None

    if _has_unlikely_shop_tag(tags) or _name_suggests_fuel_only(name):
        return FuelShopAssessment(
            confidence=FuelShopConfidence.UNLIKELY,
            label="Fuel only",
            score_adjustment=-26.0,
        )

    if _has_confirmed_shop_tag(tags):
        return FuelShopAssessment(
            confidence=FuelShopConfidence.CONFIRMED,
            label="Shop confirmed",
            score_adjustment=12.0,
        )

    if _brand_suggests_shop(tags, brand) or _name_suggests_shop(name, brand):
        return FuelShopAssessment(
            confidence=FuelShopConfidence.LIKELY,
            label="Shop likely",
            score_adjustment=5.0,
        )

    return FuelShopAssessment(
        confidence=FuelShopConfidence.UNKNOWN,
        label="Shop unknown",
        score_adjustment=-16.0,
    )


def fuel_shop_score_adjustment(poi_category: str, tags: dict[str, str], name: str | None, brand: str | None) -> float:
    assessment = assess_fuel_shop(category=poi_category, tags=tags, name=name, brand=brand)
    return assessment.score_adjustment if assessment else 0.0
