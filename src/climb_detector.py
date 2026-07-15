"""Detect continuous uphill efforts from a GPX track."""

from dataclasses import dataclass, replace

from climb_config import DEFAULT_CLIMB_DETECTION_CONFIG, ClimbDetectionConfig
from gpx_parser import TrackPoint


@dataclass
class Climb:
    """A detected continuous uphill effort along the route."""

    climb_id: str
    start_km: float
    end_km: float
    length_km: float
    elevation_gain_m: float
    avg_gradient_pct: float


@dataclass
class ClimbCandidate:
    """Accepted or rejected climb segment for debugging and validation."""

    candidate_id: str
    start_km: float
    end_km: float
    length_km: float
    elevation_gain_m: float
    net_elevation_gain_m: float
    avg_gradient_pct: float
    max_gradient_pct: float | None
    status: str
    rejection_reason: str | None
    rejection_label: str | None
    climb_id: str | None = None


REJECTION_LABELS = {
    "minimum_elevation_gain_not_reached": "Minimum elevation gain not reached",
    "average_gradient_too_low": "Average gradient too low",
    "route_ended_before_descent": "Route ended before meaningful descent confirmed",
    "insufficient_length": "Segment too short after smoothing",
    "descent_not_confirmed": "Uphill segment visible but descent threshold was never reached",
    "gradient_threshold_not_sustained": "Rolling gradient never stayed above the trigger threshold",
}


def _candidate_overlaps_km(
    candidates: list[ClimbCandidate],
    start_km: float,
    end_km: float,
) -> bool:
    for candidate in candidates:
        if end_km < candidate.start_km or start_km > candidate.end_km:
            continue
        return True
    return False


def _supplement_observed_uphills(
    track: list[TrackPoint],
    smoothed: list[float | None],
    config: ClimbDetectionConfig,
    candidates: list[ClimbCandidate],
) -> list[ClimbCandidate]:
    """
    Add debug-only candidates for visible uphill efforts that the main detector missed.

    This helps explain zero-climb results without lowering thresholds.
    """
    if len(track) < 3:
        return candidates

    supplemented = list(candidates)
    rejected_number = sum(1 for candidate in candidates if candidate.status == "rejected")
    min_observed_gain_m = max(15.0, config.min_elevation_gain_m * 0.35)
    min_observed_length_km = 0.15

    valley_idx = 0
    while valley_idx < len(track) - 2:
        valley_ele = smoothed[valley_idx]
        if valley_ele is None:
            valley_idx += 1
            continue

        best_peak_idx = -1
        best_gain = 0.0
        for peak_idx in range(valley_idx + 1, len(track)):
            peak_ele = smoothed[peak_idx]
            if peak_ele is None:
                continue
            gain = peak_ele - valley_ele
            if gain > best_gain:
                best_gain = gain
                best_peak_idx = peak_idx
            elif best_peak_idx >= 0 and peak_ele < smoothed[best_peak_idx] - 5:
                break

        if best_peak_idx < 0 or best_gain < min_observed_gain_m:
            valley_idx += 1
            continue

        start_km, end_km, length_km, gain_m, net_gain_m, avg_gradient_pct, max_gradient_pct = (
            _build_candidate_metrics(track, smoothed, valley_idx, best_peak_idx, config)
        )

        if length_km < min_observed_length_km:
            valley_idx = best_peak_idx
            continue

        if _candidate_overlaps_km(supplemented, start_km, end_km):
            valley_idx = best_peak_idx
            continue

        reason = "descent_not_confirmed"
        label = REJECTION_LABELS[reason]
        if max_gradient_pct is not None and max_gradient_pct < config.gradient_threshold_pct:
            reason = "gradient_threshold_not_sustained"
            label = REJECTION_LABELS[reason]
        elif gain_m < config.min_elevation_gain_m:
            reason = "minimum_elevation_gain_not_reached"
            label = REJECTION_LABELS[reason]
        elif not _passes_gradient_acceptance(
            length_km,
            gain_m,
            avg_gradient_pct,
            max_gradient_pct,
            config,
        ):
            reason = "average_gradient_too_low"
            label = REJECTION_LABELS[reason]

        rejected_number += 1
        supplemented.append(
            ClimbCandidate(
                candidate_id=f"R{rejected_number:03d}",
                start_km=start_km,
                end_km=end_km,
                length_km=length_km,
                elevation_gain_m=gain_m,
                net_elevation_gain_m=net_gain_m,
                avg_gradient_pct=avg_gradient_pct,
                max_gradient_pct=max_gradient_pct,
                status="rejected",
                rejection_reason=reason,
                rejection_label=label,
                climb_id=None,
            )
        )
        valley_idx = best_peak_idx

    return supplemented


def _smooth_elevations(
    track: list[TrackPoint],
    window_m: float,
) -> list[float | None]:
    """Smooth elevations with an O(n) distance-based sliding window."""
    half_window_m = window_m / 2
    smoothed: list[float | None] = []
    left = 0
    right = 0
    running_sum = 0.0
    running_count = 0

    for center_idx, point in enumerate(track):
        center_m = point.distance_km * 1000

        while right < len(track):
            candidate_m = track[right].distance_km * 1000
            if candidate_m - center_m > half_window_m:
                break
            elevation = track[right].elevation_m
            if elevation is not None:
                running_sum += elevation
                running_count += 1
            right += 1

        while left < center_idx:
            candidate_m = track[left].distance_km * 1000
            if center_m - candidate_m <= half_window_m:
                break
            elevation = track[left].elevation_m
            if elevation is not None:
                running_sum -= elevation
                running_count -= 1
            left += 1

        smoothed.append(running_sum / running_count if running_count else None)

    return smoothed


def _lookback_index(track: list[TrackPoint], index: int, window_m: float) -> int:
    target_m = track[index].distance_km * 1000 - window_m
    lookback = index

    while lookback > 0 and track[lookback].distance_km * 1000 > target_m:
        lookback -= 1

    return lookback


def _rolling_gradient_pct(
    track: list[TrackPoint],
    smoothed: list[float | None],
    index: int,
    window_m: float,
) -> float | None:
    if smoothed[index] is None:
        return None

    lookback = _lookback_index(track, index, window_m)
    if smoothed[lookback] is None:
        return None

    run_m = (track[index].distance_km - track[lookback].distance_km) * 1000
    if run_m <= 0:
        return None

    rise_m = smoothed[index] - smoothed[lookback]
    return (rise_m / run_m) * 100


def _elevation_gain_raw(track: list[TrackPoint], start_idx: int, end_idx: int) -> float:
    gain = 0.0

    for i in range(start_idx + 1, end_idx + 1):
        prev_ele = track[i - 1].elevation_m
        curr_ele = track[i].elevation_m
        if prev_ele is None or curr_ele is None:
            continue
        diff = curr_ele - prev_ele
        if diff > 0:
            gain += diff

    return gain


def _net_gain_smoothed(
    smoothed: list[float | None],
    start_idx: int,
    end_idx: int,
) -> float:
    start_ele = smoothed[start_idx]
    end_ele = smoothed[end_idx]
    if start_ele is None or end_ele is None:
        return 0.0
    return max(0.0, end_ele - start_ele)


def _max_gradient_in_segment(
    track: list[TrackPoint],
    smoothed: list[float | None],
    start_idx: int,
    end_idx: int,
    window_m: float,
) -> float | None:
    values: list[float] = []
    for index in range(start_idx, end_idx + 1):
        gradient = _rolling_gradient_pct(track, smoothed, index, window_m)
        if gradient is not None:
            values.append(gradient)
    if not values:
        return None
    return max(values)


def _build_candidate_metrics(
    track: list[TrackPoint],
    smoothed: list[float | None],
    start_idx: int,
    end_idx: int,
    config: ClimbDetectionConfig,
) -> tuple[float, float, float, float, float, float, float | None]:
    start_km = track[start_idx].distance_km
    end_km = track[end_idx].distance_km
    length_km = end_km - start_km
    gain_m = _elevation_gain_raw(track, start_idx, end_idx)
    net_gain_m = _net_gain_smoothed(smoothed, start_idx, end_idx)
    if length_km > 0:
        avg_gradient_pct = (gain_m / (length_km * 1000)) * 100
    else:
        avg_gradient_pct = 0.0
    max_gradient_pct = _max_gradient_in_segment(
        track,
        smoothed,
        start_idx,
        end_idx,
        config.rolling_gradient_window_m,
    )
    return start_km, end_km, length_km, gain_m, net_gain_m, avg_gradient_pct, max_gradient_pct


def _passes_gradient_acceptance(
    length_km: float,
    gain_m: float,
    avg_gradient_pct: float,
    max_gradient_pct: float | None,
    config: ClimbDetectionConfig,
) -> bool:
    """Accept by average grade, or by meaningful gain with locally steep pitches."""
    if avg_gradient_pct >= config.min_average_gradient_pct:
        return True
    if max_gradient_pct is None or gain_m < config.min_elevation_gain_m or length_km <= 0:
        return False
    # Long undulating climbs often dip below the average-grade threshold because
    # flat or downhill recovery sections dilute the segment average, even when
    # total gain and steepest pitches are clearly meaningful to a rider.
    if max_gradient_pct >= 5.0 and length_km >= 1.0 and gain_m >= 150:
        return True
    if max_gradient_pct >= 6.0 and length_km >= 0.75 and gain_m >= config.min_elevation_gain_m:
        return True
    return False


def _rejection_for_metrics(
    length_km: float,
    gain_m: float,
    avg_gradient_pct: float,
    config: ClimbDetectionConfig,
    *,
    max_gradient_pct: float | None = None,
    route_ended: bool = False,
) -> tuple[str | None, str | None]:
    if length_km <= 0:
        return "insufficient_length", REJECTION_LABELS["insufficient_length"]

    reasons: list[str] = []
    labels: list[str] = []

    if gain_m < config.min_elevation_gain_m:
        reasons.append("minimum_elevation_gain_not_reached")
        labels.append(REJECTION_LABELS["minimum_elevation_gain_not_reached"])

    if not _passes_gradient_acceptance(
        length_km,
        gain_m,
        avg_gradient_pct,
        max_gradient_pct,
        config,
    ):
        reasons.append("average_gradient_too_low")
        labels.append(REJECTION_LABELS["average_gradient_too_low"])

    if route_ended and not reasons:
        return "route_ended_before_descent", REJECTION_LABELS["route_ended_before_descent"]

    if not reasons:
        return None, None

    return ";".join(reasons), "; ".join(labels)


def _build_climb(
    track: list[TrackPoint],
    start_idx: int,
    end_idx: int,
    climb_number: int,
) -> Climb:
    start_km = track[start_idx].distance_km
    end_km = track[end_idx].distance_km
    length_km = end_km - start_km
    gain_m = _elevation_gain_raw(track, start_idx, end_idx)

    if length_km > 0:
        avg_gradient_pct = (gain_m / (length_km * 1000)) * 100
    else:
        avg_gradient_pct = 0.0

    return Climb(
        climb_id=f"C{climb_number:03d}",
        start_km=start_km,
        end_km=end_km,
        length_km=length_km,
        elevation_gain_m=gain_m,
        avg_gradient_pct=avg_gradient_pct,
    )


def detect_climbs_with_debug(
    track: list[TrackPoint],
    config: ClimbDetectionConfig | None = None,
) -> tuple[list[Climb], list[ClimbCandidate]]:
    """Detect climbs and return rejected candidates for validation tooling."""
    resolved_config = config or DEFAULT_CLIMB_DETECTION_CONFIG

    if not track:
        return [], []

    smoothed = _smooth_elevations(track, resolved_config.smoothing_window_m)

    climbs: list[Climb] = []
    candidates: list[ClimbCandidate] = []
    in_climb = False
    start_idx = 0
    summit_idx = 0
    climb_number = 0
    rejected_number = 0

    def record_candidate(
        start_index: int,
        end_index: int,
        *,
        route_ended: bool = False,
    ) -> None:
        nonlocal climb_number, rejected_number

        (
            start_km,
            end_km,
            length_km,
            gain_m,
            net_gain_m,
            avg_gradient_pct,
            max_gradient_pct,
        ) = _build_candidate_metrics(track, smoothed, start_index, end_index, resolved_config)

        reason, label = _rejection_for_metrics(
            length_km,
            gain_m,
            avg_gradient_pct,
            resolved_config,
            max_gradient_pct=max_gradient_pct,
            route_ended=route_ended,
        )

        if reason is None:
            climb_number += 1
            climb_id = f"C{climb_number:03d}"
            climbs.append(_build_climb(track, start_index, end_index, climb_number))
            candidates.append(
                ClimbCandidate(
                    candidate_id=climb_id,
                    start_km=start_km,
                    end_km=end_km,
                    length_km=length_km,
                    elevation_gain_m=gain_m,
                    net_elevation_gain_m=net_gain_m,
                    avg_gradient_pct=avg_gradient_pct,
                    max_gradient_pct=max_gradient_pct,
                    status="accepted",
                    rejection_reason=None,
                    rejection_label=None,
                    climb_id=climb_id,
                )
            )
            return

        rejected_number += 1
        candidates.append(
            ClimbCandidate(
                candidate_id=f"R{rejected_number:03d}",
                start_km=start_km,
                end_km=end_km,
                length_km=length_km,
                elevation_gain_m=gain_m,
                net_elevation_gain_m=net_gain_m,
                avg_gradient_pct=avg_gradient_pct,
                max_gradient_pct=max_gradient_pct,
                status="rejected",
                rejection_reason=reason,
                rejection_label=label,
                climb_id=None,
            )
        )

    for i in range(len(track)):
        gradient = _rolling_gradient_pct(
            track,
            smoothed,
            i,
            resolved_config.rolling_gradient_window_m,
        )

        if not in_climb:
            if gradient is not None and gradient > resolved_config.gradient_threshold_pct:
                in_climb = True
                start_idx = _lookback_index(track, i, resolved_config.rolling_gradient_window_m)
                summit_idx = i
            continue

        if (
            smoothed[i] is not None
            and smoothed[summit_idx] is not None
            and smoothed[i] > smoothed[summit_idx]
        ):
            summit_idx = i

        if (
            smoothed[i] is not None
            and smoothed[summit_idx] is not None
            and smoothed[summit_idx] - smoothed[i] >= resolved_config.meaningful_descent_threshold_m
        ):
            record_candidate(start_idx, summit_idx)
            in_climb = False

    if in_climb:
        record_candidate(start_idx, summit_idx, route_ended=True)

    candidates = _supplement_observed_uphills(track, smoothed, resolved_config, candidates)

    return climbs, candidates


def detect_climbs(
    track: list[TrackPoint],
    config: ClimbDetectionConfig | None = None,
) -> list[Climb]:
    """Detect every accepted continuous uphill effort on the track."""
    climbs, _ = detect_climbs_with_debug(track, config)
    return climbs
