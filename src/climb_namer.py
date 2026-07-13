"""Resolve meaningful climb names from OSM data matched to the route."""

from __future__ import annotations

from dataclasses import dataclass

from climb_detector import Climb
from gpx_parser import TrackPoint
from surface_detector import SurfaceDataset


@dataclass(frozen=True)
class ClimbNameResult:
    suggested_name: str | None
    name_source: str | None
    name_confidence: float | None = None


def _tag_name(tags: dict[str, str]) -> str | None:
    for key in ("name", "name:en", "alt_name", "official_name"):
        value = tags.get(key)
        if value and value.strip():
            return value.strip()
    ref = tags.get("ref")
    if ref and ref.strip():
        return ref.strip()
    return None


def _collect_candidates(tags: dict[str, str]) -> list[tuple[int, str, str, float]]:
    candidates: list[tuple[int, str, str, float]] = []
    name = _tag_name(tags)
    if not name:
        return candidates

    if tags.get("mountain_pass") == "yes" or tags.get("pass") == "yes":
        candidates.append((1, name, "pass", 0.95))
    natural = tags.get("natural")
    if natural == "saddle":
        candidates.append((1, name, "pass", 0.92))
    if natural == "peak":
        candidates.append((2, name, "peak", 0.88))
    if tags.get("place") in {"locality", "hamlet", "village", "town"}:
        candidates.append((4, name, "locality", 0.75))
    if tags.get("highway") and name:
        candidates.append((5, name, "road", 0.7))
    return candidates


def _nearest_place_name(
    climb: Climb,
    surface_dataset: SurfaceDataset,
) -> tuple[str, str, float] | None:
    """Find the nearest named locality along or just after the climb."""
    search_points = [
        point
        for point in surface_dataset.points
        if climb.end_km <= point.distance_km <= climb.end_km + 8.0
    ]
    for point in sorted(search_points, key=lambda item: item.distance_km):
        place = point.tags.get("place")
        name = _tag_name(point.tags)
        if place in {"locality", "hamlet", "village", "town"} and name:
            return f"Climb to {name}", "locality", 0.65
    return None


def _contextual_fallback_name(
    climb: Climb,
    surface_dataset: SurfaceDataset,
) -> ClimbNameResult:
    """Build a place-oriented fallback — never a generic numbered climb label."""
    nearby = _nearest_place_name(climb, surface_dataset)
    if nearby is not None:
        label, source, confidence = nearby
        return ClimbNameResult(label, source, confidence)

    climb_points = [
        point
        for point in surface_dataset.points
        if climb.start_km <= point.distance_km <= climb.end_km + 0.2
    ]
    for point in reversed(climb_points):
        name = _tag_name(point.tags)
        if name and point.tags.get("highway"):
            return ClimbNameResult(f"Climb on {name}", "road", 0.6)

    for point in reversed(climb_points):
        ref = point.tags.get("ref")
        if ref and ref.strip() and point.tags.get("highway"):
            return ClimbNameResult(f"Climb on {ref.strip()}", "road_ref", 0.55)

    return ClimbNameResult(
        f"Climb near km {round(climb.start_km)}",
        "distance_marker",
        0.4,
    )


def resolve_climb_name(climb: Climb, surface_dataset: SurfaceDataset | None) -> ClimbNameResult:
    if surface_dataset is None:
        return ClimbNameResult(
            f"Climb near km {round(climb.start_km)}",
            "distance_marker",
            0.4,
        )

    points = [
        point
        for point in surface_dataset.points
        if climb.start_km <= point.distance_km <= climb.end_km + 0.2
    ]
    if not points:
        return _contextual_fallback_name(climb, surface_dataset)

    summit_km = climb.end_km
    summit_point = min(points, key=lambda point: abs(point.distance_km - summit_km))
    ordered = [summit_point, *points, *reversed(points)]

    best: tuple[int, str, str, float] | None = None
    seen: set[str] = set()
    for point in ordered:
        for candidate in _collect_candidates(point.tags):
            priority, name, source, confidence = candidate
            if name in seen:
                continue
            seen.add(name)
            if best is None or priority < best[0]:
                best = candidate

    if best is not None:
        _, name, source, confidence = best
        return ClimbNameResult(name, source, confidence)

    return _contextual_fallback_name(climb, surface_dataset)


def resolve_climb_names(
    climbs: list[Climb],
    surface_dataset: SurfaceDataset | None,
) -> dict[str, ClimbNameResult]:
    return {climb.climb_id: resolve_climb_name(climb, surface_dataset) for climb in climbs}


def summit_coordinates(climb: Climb, track: list[TrackPoint]) -> tuple[float, float] | None:
    if not track:
        return None
    summit = min(track, key=lambda point: abs(point.distance_km - climb.end_km))
    return summit.lat, summit.lon
