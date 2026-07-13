"""Conservative surface resolution after GPX-to-OSM geometric matching."""

from __future__ import annotations

from surface_types import (
    ResolvedSurface,
    RiderCategory,
    SurfaceSource,
    OSM_SURFACE_TO_RIDER,
    unknown_surface,
)

# Conservative thresholds — prefer Unknown over a wrong inference.
MIN_MATCH_CONFIDENCE = 0.65
MIN_SNAP_DISTANCE_M = 18.0
MIN_PROPAGATION_CONFIDENCE = 0.72
MAX_PROPAGATION_GAP_KM = 0.35

HIGHWAY_ROAD = frozenset(
    {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link"}
)
HIGHWAY_ROAD_LOW = frozenset({"residential", "living_street", "unclassified", "service", "cycleway"})
HIGHWAY_TRAIL = frozenset({"path", "footway", "bridleway", "steps", "pedestrian"})
HIGHWAY_TRACK = frozenset({"track"})


def resolve_from_osm_tag(osm_surface: str) -> ResolvedSurface | None:
    mapped = OSM_SURFACE_TO_RIDER.get(osm_surface)
    if mapped is None:
        return None
    category, subcategory = mapped
    return ResolvedSurface(
        rider_category=category,
        rider_subcategory=subcategory,
        surface_source=SurfaceSource.OSM_TAG,
        confidence=1.0,
        osm_surface=osm_surface,
    )


def _tracktype_subcategory(tracktype: str | None) -> tuple[RiderCategory, str, float]:
    if tracktype in {"grade1", "grade2"}:
        return RiderCategory.GRAVEL, "Compact gravel", 0.75
    if tracktype in {"grade3", "grade4", "grade5"}:
        return RiderCategory.GRAVEL, "Loose gravel", 0.7
    return RiderCategory.GRAVEL, "Forest road", 0.68


def _infer_from_highway(
    highway: str | None,
    tracktype: str | None,
    match_confidence: float,
    snap_distance_m: float,
) -> ResolvedSurface | None:
    if highway is None or match_confidence < MIN_MATCH_CONFIDENCE or snap_distance_m > MIN_SNAP_DISTANCE_M:
        return None

    if highway in HIGHWAY_ROAD:
        return ResolvedSurface(
            rider_category=RiderCategory.ROAD,
            rider_subcategory="Asphalt",
            surface_source=SurfaceSource.HIGHWAY_INFERRED,
            confidence=round(min(match_confidence, 0.82), 3),
            osm_surface=None,
        )

    if highway in HIGHWAY_ROAD_LOW:
        if match_confidence < 0.75:
            return None
        return ResolvedSurface(
            rider_category=RiderCategory.ROAD,
            rider_subcategory="Asphalt",
            surface_source=SurfaceSource.HIGHWAY_INFERRED,
            confidence=round(min(match_confidence, 0.7), 3),
            osm_surface=None,
        )

    if highway in HIGHWAY_TRACK:
        category, subcategory, cap = _tracktype_subcategory(tracktype)
        return ResolvedSurface(
            rider_category=category,
            rider_subcategory=subcategory,
            surface_source=SurfaceSource.HIGHWAY_INFERRED,
            confidence=round(min(match_confidence, cap), 3),
            osm_surface=None,
        )

    if highway in HIGHWAY_TRAIL:
        subcategory = "Hiking trail" if highway in {"footway", "steps", "pedestrian"} else "Singletrack"
        return ResolvedSurface(
            rider_category=RiderCategory.TRAIL,
            rider_subcategory=subcategory,
            surface_source=SurfaceSource.HIGHWAY_INFERRED,
            confidence=round(min(match_confidence, 0.78), 3),
            osm_surface=None,
        )

    return None


def resolve_point_surface(
    *,
    matched: bool,
    osm_surface: str | None,
    tags: dict[str, str],
    match_confidence: float,
    snap_distance_m: float,
) -> ResolvedSurface:
    """Resolve one point using OSM tags first, then conservative highway inference."""
    if not matched:
        return ResolvedSurface(
            rider_category=RiderCategory.UNKNOWN,
            rider_subcategory="Unknown",
            surface_source=SurfaceSource.UNMATCHED,
            confidence=0.0,
            osm_surface=None,
        )

    if osm_surface is not None:
        from_tag = resolve_from_osm_tag(osm_surface)
        if from_tag is not None:
            return from_tag
        # Unmapped tag — do not guess; leave Unknown with tag preserved for Verify.
        return ResolvedSurface(
            rider_category=RiderCategory.UNKNOWN,
            rider_subcategory="Unknown",
            surface_source=SurfaceSource.OSM_TAG,
            confidence=0.5,
            osm_surface=osm_surface,
        )

    inferred = _infer_from_highway(
        tags.get("highway"),
        tags.get("tracktype"),
        match_confidence,
        snap_distance_m,
    )
    if inferred is not None:
        return inferred

    return ResolvedSurface(
        rider_category=RiderCategory.UNKNOWN,
        rider_subcategory="Unknown",
        surface_source=SurfaceSource.INSUFFICIENT_EVIDENCE,
        confidence=round(match_confidence * 0.4, 3),
        osm_surface=None,
    )


def propagate_resolved_surfaces(resolved: list[ResolvedSurface], distance_km: list[float]) -> list[ResolvedSurface]:
    """Fill short gaps by inheriting from neighbours on the same logical stretch."""
    if len(resolved) < 3:
        return resolved

    output = list(resolved)

    # Same-category bridge across small Unknown gaps.
    index = 1
    while index < len(output) - 1:
        left = output[index - 1]
        current = output[index]
        right = output[index + 1]

        if current.rider_category != RiderCategory.UNKNOWN:
            index += 1
            continue

        gap_km = distance_km[index + 1] - distance_km[index - 1]
        if gap_km > MAX_PROPAGATION_GAP_KM:
            index += 1
            continue

        if (
            left.rider_category == right.rider_category
            and left.rider_category != RiderCategory.UNKNOWN
            and left.confidence >= MIN_PROPAGATION_CONFIDENCE
            and right.confidence >= MIN_PROPAGATION_CONFIDENCE
        ):
            output[index] = ResolvedSurface(
                rider_category=left.rider_category,
                rider_subcategory=left.rider_subcategory,
                surface_source=SurfaceSource.PROPAGATED,
                confidence=round(min(left.confidence, right.confidence) * 0.95, 3),
                osm_surface=left.osm_surface,
            )
        index += 1

    return output
