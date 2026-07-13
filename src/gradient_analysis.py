"""Compute maximum rolling-gradient statistics for detected climbs."""

from dataclasses import dataclass

from climb_detector import Climb
from gpx_parser import TrackPoint

# Distance windows (meters) for maximum average-gradient analysis.
GRADIENT_WINDOWS_M = (50, 100, 250, 500, 1000)


@dataclass
class ClimbGradientStats:
    """Maximum average gradient (%) over each rolling distance window within a climb."""

    max_50_m_pct: float | None
    max_100_m_pct: float | None
    max_250_m_pct: float | None
    max_500_m_pct: float | None
    max_1000_m_pct: float | None


def _find_climb_indices(track: list[TrackPoint], climb: Climb) -> tuple[int, int]:
    """Return the first and last track indices that fall within the climb distance range."""
    start_idx = 0
    end_idx = len(track) - 1

    for i, point in enumerate(track):
        if point.distance_km >= climb.start_km:
            start_idx = i
            break

    for i in range(len(track) - 1, -1, -1):
        if track[i].distance_km <= climb.end_km:
            end_idx = i
            break

    return start_idx, end_idx


def _lookback_index(track: list[TrackPoint], index: int, window_m: float) -> int:
    """Return the earliest index whose distance is at or before (current - window_m)."""
    target_m = track[index].distance_km * 1000 - window_m
    lookback = index

    while lookback > 0 and track[lookback].distance_km * 1000 > target_m:
        lookback -= 1

    return lookback


def _average_gradient_pct(
    track: list[TrackPoint],
    start_idx: int,
    end_idx: int,
) -> float | None:
    """Calculate average gradient (%) between two track indices using raw elevation."""
    start_ele = track[start_idx].elevation_m
    end_ele = track[end_idx].elevation_m
    if start_ele is None or end_ele is None:
        return None

    run_m = (track[end_idx].distance_km - track[start_idx].distance_km) * 1000
    if run_m <= 0:
        return None

    rise_m = end_ele - start_ele
    return (rise_m / run_m) * 100


def _max_rolling_gradient(
    track: list[TrackPoint],
    climb_start_idx: int,
    climb_end_idx: int,
    window_m: float,
) -> float | None:
    """
    Find the maximum average gradient inside a climb using a sliding distance window.

    At each point inside the climb, look back `window_m` meters along the route.
    The window must fit entirely within the climb boundaries.
    """
    climb_start_m = track[climb_start_idx].distance_km * 1000
    max_gradient: float | None = None

    for i in range(climb_start_idx, climb_end_idx + 1):
        # The full window must stay inside the climb.
        target_m = track[i].distance_km * 1000 - window_m
        if target_m < climb_start_m:
            continue

        j = _lookback_index(track, i, window_m)
        if j < climb_start_idx:
            continue

        gradient = _average_gradient_pct(track, j, i)
        if gradient is None:
            continue

        if max_gradient is None or gradient > max_gradient:
            max_gradient = gradient

    if max_gradient is None:
        return None

    return round(max_gradient, 1)


def analyze_climb_gradients(
    track: list[TrackPoint],
    climb: Climb,
) -> ClimbGradientStats:
    """Compute maximum rolling-gradient values for every analysis window on one climb."""
    start_idx, end_idx = _find_climb_indices(track, climb)

    return ClimbGradientStats(
        max_50_m_pct=_max_rolling_gradient(track, start_idx, end_idx, 50),
        max_100_m_pct=_max_rolling_gradient(track, start_idx, end_idx, 100),
        max_250_m_pct=_max_rolling_gradient(track, start_idx, end_idx, 250),
        max_500_m_pct=_max_rolling_gradient(track, start_idx, end_idx, 500),
        max_1000_m_pct=_max_rolling_gradient(track, start_idx, end_idx, 1000),
    )


def analyze_all_climbs(
    track: list[TrackPoint],
    climbs: list[Climb],
) -> list[tuple[Climb, ClimbGradientStats]]:
    """Compute gradient statistics for every detected climb."""
    return [(climb, analyze_climb_gradients(track, climb)) for climb in climbs]
