"""Surface type definitions, rider categories, and OSM mapping."""

from dataclasses import dataclass
from enum import Enum


class ReportGroup(str, Enum):
    """Legacy three-group summary — kept for validation exports."""

    ASPHALT = "Asphalt"
    GRAVEL = "Gravel"
    UNKNOWN = "Unknown"


class RiderCategory(str, Enum):
    """Rider-facing surface categories shown in the main UI."""

    ROAD = "Road"
    GRAVEL = "Gravel"
    TRAIL = "Trail"
    UNKNOWN = "Unknown"


class SurfaceSource(str, Enum):
    """How a surface value was determined."""

    OSM_TAG = "osm_tag"
    OSM_MAPPED = "osm_mapped"
    HIGHWAY_INFERRED = "highway_inferred"
    PROPAGATED = "propagated"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    UNMATCHED = "unmatched"


# Internal merge key when surface cannot be resolved.
INTERNAL_UNKNOWN = "unknown"

# Maps exact OSM ``surface`` tag strings to rider category + subcategory (Verify detail).
OSM_SURFACE_TO_RIDER: dict[str, tuple[RiderCategory, str]] = {
    "asphalt": (RiderCategory.ROAD, "Asphalt"),
    "concrete": (RiderCategory.ROAD, "Smooth asphalt"),
    "paving_stones": (RiderCategory.ROAD, "Smooth asphalt"),
    "paved": (RiderCategory.ROAD, "Asphalt"),
    "sett": (RiderCategory.ROAD, "Rough asphalt"),
    "cobblestone": (RiderCategory.ROAD, "Rough asphalt"),
    "cobbles": (RiderCategory.ROAD, "Rough asphalt"),
    "compacted": (RiderCategory.GRAVEL, "Compact gravel"),
    "fine_gravel": (RiderCategory.GRAVEL, "Compact gravel"),
    "gravel": (RiderCategory.GRAVEL, "Hard gravel"),
    "pebblestone": (RiderCategory.GRAVEL, "Hard gravel"),
    "ground": (RiderCategory.GRAVEL, "Hard gravel"),
    "rock": (RiderCategory.GRAVEL, "Hard gravel"),
    "dirt": (RiderCategory.GRAVEL, "Loose gravel"),
    "unpaved": (RiderCategory.GRAVEL, "Loose gravel"),
    "sand": (RiderCategory.GRAVEL, "Loose gravel"),
    "mud": (RiderCategory.GRAVEL, "Loose gravel"),
    "grass": (RiderCategory.TRAIL, "Hiking trail"),
    "wood": (RiderCategory.TRAIL, "Singletrack"),
    "woodchips": (RiderCategory.TRAIL, "Singletrack"),
}

# Legacy mapping for CSV exports that still use Asphalt/Gravel/Unknown.
OSM_SURFACE_TO_REPORT_GROUP: dict[str, ReportGroup] = {
    key: (
        ReportGroup.ASPHALT
        if category == RiderCategory.ROAD
        else ReportGroup.GRAVEL
        if category == RiderCategory.GRAVEL
        else ReportGroup.UNKNOWN
    )
    for key, (category, _) in OSM_SURFACE_TO_RIDER.items()
}


RIDER_CATEGORY_COLORS: dict[RiderCategory, str] = {
    RiderCategory.ROAD: "#2563eb",
    RiderCategory.GRAVEL: "#854d0e",
    RiderCategory.TRAIL: "#16a34a",
    RiderCategory.UNKNOWN: "#ef4444",
}


@dataclass(frozen=True)
class ResolvedSurface:
    """Rider-facing surface classification for one matched point."""

    rider_category: RiderCategory
    rider_subcategory: str
    surface_source: SurfaceSource
    confidence: float
    osm_surface: str | None


@dataclass(frozen=True)
class SurfaceSummary:
    """Distance totals grouped for summaries."""

    road_km: float
    gravel_km: float
    trail_km: float
    unknown_km: float

    @property
    def asphalt_km(self) -> float:
        """Backward-compatible alias for road distance."""
        return self.road_km

    def road_pct(self, total_km: float) -> float:
        return (self.road_km / total_km * 100) if total_km > 0 else 0.0

    def gravel_pct(self, total_km: float) -> float:
        return (self.gravel_km / total_km * 100) if total_km > 0 else 0.0

    def trail_pct(self, total_km: float) -> float:
        return (self.trail_km / total_km * 100) if total_km > 0 else 0.0

    def unknown_pct(self, total_km: float) -> float:
        return (self.unknown_km / total_km * 100) if total_km > 0 else 0.0

    def asphalt_pct(self, total_km: float) -> float:
        return self.road_pct(total_km)


def report_group_for_surface(osm_surface: str | None) -> ReportGroup:
    """Map a raw OSM ``surface`` value to a legacy reporting group."""
    if osm_surface is None:
        return ReportGroup.UNKNOWN
    return OSM_SURFACE_TO_REPORT_GROUP.get(osm_surface, ReportGroup.UNKNOWN)


def report_group_for_rider(category: RiderCategory) -> ReportGroup:
    if category == RiderCategory.ROAD:
        return ReportGroup.ASPHALT
    if category == RiderCategory.GRAVEL:
        return ReportGroup.GRAVEL
    return ReportGroup.UNKNOWN


def is_missing_osm_surface(osm_surface: str | None, matched: bool) -> bool:
    """
    Return True when OSM surface data is absent and should be flagged for review.

    Explicit values such as ``grass`` are preserved but are not "missing".
    """
    return not matched or osm_surface is None


def unknown_surface() -> ResolvedSurface:
    return ResolvedSurface(
        rider_category=RiderCategory.UNKNOWN,
        rider_subcategory="Unknown",
        surface_source=SurfaceSource.UNMATCHED,
        confidence=0.0,
        osm_surface=None,
    )
