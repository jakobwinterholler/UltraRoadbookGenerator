"""Configurable POI scoring for decision-point primary selection."""

from dataclasses import dataclass, field

from gas_station_shop import assess_fuel_shop
from opening_hours_score import opening_hours_reliability_bonus
from poi_types import PointOfInterest
from supermarket_ranking import supermarket_size_bonus


@dataclass
class PoiScoreWeights:
    """
    Tunable weights for ranking POIs at a decision point.

    Higher scores are better. Off-route distance subtracts from the score.
    """

    off_route_penalty_per_m: float = 0.45

    priority_weight: dict[int, float] = field(
        default_factory=lambda: {
            1: 40.0,
            2: 12.0,
            3: 0.0,
        }
    )

    category_weight: dict[str, float] = field(
        default_factory=lambda: {
            "Gas station": 40.0,
            "Small supermarket": 36.0,
            "Mini supermarket": 32.0,
            "Drinking water": 26.0,
            "Supermarket": 20.0,
            "Convenience store": 22.0,
            "Bakery": 18.0,
            "Fast food": 10.0,
            "Café": 8.0,
            "Restaurant": 6.0,
        }
    )

    named_bonus: float = 12.0
    brand_bonus: float = 6.0
    unnamed_drinking_water_penalty: float = 10.0


DEFAULT_POI_SCORE_WEIGHTS = PoiScoreWeights()


def estimate_reliability_bonus(
    poi: PointOfInterest,
    weights: PoiScoreWeights,
    *,
    country_code: str | None = None,
) -> float:
    """Estimate POI reliability from preserved OSM metadata."""
    bonus = 0.0

    if poi.name:
        bonus += weights.named_bonus
    bonus += opening_hours_reliability_bonus(poi.opening_hours)
    if poi.brand:
        bonus += weights.brand_bonus
    if poi.category == "Drinking water" and not poi.name and not poi.brand:
        bonus -= weights.unnamed_drinking_water_penalty

    bonus += supermarket_size_bonus(
        category=poi.category,
        tags=poi.tags,
        country_code=country_code,
    )

    shop_assessment = assess_fuel_shop(
        category=poi.category,
        tags=poi.tags,
        name=poi.name,
        brand=poi.brand,
    )
    if shop_assessment is not None:
        bonus += shop_assessment.score_adjustment

    return bonus


def score_poi(
    poi: PointOfInterest,
    weights: PoiScoreWeights = DEFAULT_POI_SCORE_WEIGHTS,
    *,
    country_code: str | None = None,
) -> float:
    """
    Score one POI for primary selection at a decision point.

    Combines POI type, reliability signals, and off-route distance.
    """
    score = weights.priority_weight.get(poi.priority, 0.0)
    score += weights.category_weight.get(poi.category, 0.0)
    score += estimate_reliability_bonus(poi, weights, country_code=country_code)
    score -= poi.distance_off_route_m * weights.off_route_penalty_per_m
    return round(score, 2)


def build_score_cache(
    pois: list[PointOfInterest],
    weights: PoiScoreWeights = DEFAULT_POI_SCORE_WEIGHTS,
) -> dict[tuple[int, str], float]:
    """Pre-compute POI scores once for zone building and API output."""
    return {
        (poi.osm_id, poi.osm_type): score_poi(poi, weights)
        for poi in pois
    }
