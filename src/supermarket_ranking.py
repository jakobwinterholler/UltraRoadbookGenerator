"""Country and brand preferences for supermarket ranking."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class BrandPreference:
    """Score adjustment for a known retail brand."""

    brand: str
    country_codes: frozenset[str]
    score_bonus: float
    size_class: str


@dataclass
class SupermarketRankingConfig:
    """
    Configurable supermarket brand preferences by country.

    Positive bonuses favour compact, cyclist-friendly stores.
    Negative bonuses penalise large hypermarkets and shopping centres.
    """

    preferred_brands: tuple[BrandPreference, ...] = (
        BrandPreference("Condis", frozenset({"IT", "ES"}), 18.0, "small"),
        BrandPreference("Spar", frozenset({"AT", "DE", "IT", "CH"}), 16.0, "small"),
        BrandPreference("Carrefour Express", frozenset({"FR", "ES", "IT"}), 14.0, "small"),
        BrandPreference("Bonpreu", frozenset({"ES"}), 16.0, "small"),
        BrandPreference("Coop", frozenset({"CH", "IT"}), 14.0, "small"),
        BrandPreference("Migros", frozenset({"CH"}), 12.0, "small"),
        BrandPreference("REWE", frozenset({"DE", "AT"}), 10.0, "small"),
        BrandPreference("Lidl", frozenset(), 8.0, "small"),
        BrandPreference("Aldi", frozenset(), 8.0, "small"),
        BrandPreference("Penny", frozenset({"DE", "AT"}), 8.0, "small"),
        BrandPreference("Edeka", frozenset({"DE"}), 6.0, "small"),
    )

    hypermarket_brands: tuple[BrandPreference, ...] = (
        BrandPreference("Carrefour", frozenset({"FR", "ES", "IT"}), -18.0, "hyper"),
        BrandPreference("Auchan", frozenset({"FR", "PL"}), -20.0, "hyper"),
        BrandPreference("E.Leclerc", frozenset({"FR"}), -16.0, "hyper"),
        BrandPreference("Intermarché Hyper", frozenset({"FR"}), -16.0, "hyper"),
        BrandPreference("Hyper U", frozenset({"FR"}), -14.0, "hyper"),
        BrandPreference("Mercadona", frozenset({"ES"}), -10.0, "hyper"),
        BrandPreference("Walmart", frozenset({"US"}), -20.0, "hyper"),
        BrandPreference("Tesco Extra", frozenset({"GB"}), -14.0, "hyper"),
    )

    hypermarket_keywords: tuple[str, ...] = (
        "hypermarket",
        "hyper marché",
        "shopping centre",
        "shopping center",
        "mall",
        "centro commerciale",
    )

    convenience_bonus: float = 12.0
    unnamed_supermarket_bonus: float = 4.0
    generic_supermarket_penalty: float = 4.0


DEFAULT_SUPERMARKET_RANKING = SupermarketRankingConfig()


def _normalize_label(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def _matches_brand(candidate: str, brand: str) -> bool:
    normalized_candidate = _normalize_label(candidate)
    normalized_brand = _normalize_label(brand)
    if not normalized_candidate or not normalized_brand:
        return False
    if normalized_candidate == normalized_brand:
        return True
    if normalized_brand in normalized_candidate:
        return True
    return normalized_candidate.startswith(normalized_brand)


def _country_matches(country_codes: frozenset[str], country_code: str | None) -> bool:
    if not country_codes:
        return True
    if not country_code:
        return True
    return country_code.upper() in country_codes


def supermarket_size_bonus(
    *,
    category: str,
    tags: dict[str, str],
    country_code: str | None = None,
    config: SupermarketRankingConfig = DEFAULT_SUPERMARKET_RANKING,
) -> float:
    """
    Return a planning score adjustment based on supermarket size and brand.

    Convenience and known compact chains score higher; hypermarkets lower.
    """
    if category not in {"Mini supermarket", "Small supermarket", "Supermarket"}:
        return 0.0

    if category == "Mini supermarket":
        return config.convenience_bonus

    labels = [
        tags.get("brand"),
        tags.get("operator"),
        tags.get("name"),
    ]

    for preference in config.preferred_brands:
        if not _country_matches(preference.country_codes, country_code):
            continue
        if any(_matches_brand(label, preference.brand) for label in labels):
            return preference.score_bonus

    for preference in config.hypermarket_brands:
        if not _country_matches(preference.country_codes, country_code):
            continue
        if any(_matches_brand(label, preference.brand) for label in labels):
            return preference.score_bonus

    combined = " ".join(_normalize_label(label) for label in labels if label)
    if tags.get("shop") == "supermarket" and tags.get("supermarket") in {"hypermarket", "super_center"}:
        return -16.0

    if any(keyword in combined for keyword in config.hypermarket_keywords):
        return -12.0

    if category == "Small supermarket":
        return config.unnamed_supermarket_bonus

    if category == "Supermarket":
        return -config.generic_supermarket_penalty

    return 0.0


def classify_supermarket_category(tags: dict[str, str]) -> str:
    """Distinguish compact supermarkets from generic large stores."""
    if tags.get("shop") == "convenience":
        return "Mini supermarket"

    if tags.get("shop") != "supermarket":
        return "Supermarket"

    labels = [tags.get("brand"), tags.get("operator"), tags.get("name")]
    combined = " ".join(_normalize_label(label) for label in labels if label)

    if tags.get("supermarket") in {"hypermarket", "super_center"}:
        return "Supermarket"

    if any(keyword in combined for keyword in DEFAULT_SUPERMARKET_RANKING.hypermarket_keywords):
        return "Supermarket"

    for preference in DEFAULT_SUPERMARKET_RANKING.hypermarket_brands:
        if any(_matches_brand(label, preference.brand) for label in labels):
            return "Supermarket"

    for preference in DEFAULT_SUPERMARKET_RANKING.preferred_brands:
        if any(_matches_brand(label, preference.brand) for label in labels):
            return "Small supermarket"

    return "Supermarket"
