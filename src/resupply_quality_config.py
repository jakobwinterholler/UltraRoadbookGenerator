"""Tunable settings for resupply quality overlays along the route."""

from dataclasses import dataclass


@dataclass
class ResupplyQualityConfig:
    """Distance and score thresholds for route resupply-quality bands."""

    excellent_max_km: float = 15.0
    good_max_km: float = 30.0
    limited_max_km: float = 50.0

    reliable_food_score: float = 35.0
    reliable_water_score: float = 10.0


DEFAULT_RESUPPLY_QUALITY_CONFIG = ResupplyQualityConfig()

QUALITY_COLORS = {
    "excellent": "#22c55e",
    "good": "#eab308",
    "limited": "#f97316",
    "poor": "#ef4444",
}

QUALITY_LABELS = {
    "excellent": "Excellent",
    "good": "Good",
    "limited": "Limited",
    "poor": "Poor",
}

QUALITY_EMOJIS = {
    "excellent": "🟢",
    "good": "🟡",
    "limited": "🟠",
    "poor": "🔴",
}
