"""Configurable climb detection parameters for the web UI."""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ClimbDetectionConfig:
    """Tunable climb detection parameters exposed to the frontend."""

    smoothing_window_m: float = 60.0
    rolling_gradient_window_m: float = 100.0
    gradient_threshold_pct: float = 1.0
    meaningful_descent_threshold_m: float = 50.0
    min_elevation_gain_m: float = 50.0
    min_average_gradient_pct: float = 3.0

    def to_dict(self) -> dict[str, float]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict | None) -> ClimbDetectionConfig:
        if not payload:
            return DEFAULT_CLIMB_DETECTION_CONFIG
        known = {field.name for field in cls.__dataclass_fields__.values()}
        filtered = {key: float(value) for key, value in payload.items() if key in known}
        return cls(**filtered)


DEFAULT_CLIMB_DETECTION_CONFIG = ClimbDetectionConfig()
