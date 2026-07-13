"""Validation exports and diagnostics for the surface detection engine."""

import csv
from collections import Counter
from pathlib import Path

from gpx_parser import TrackPoint
from surface_detector import SurfaceDataset, SurfaceSegment
from surface_gpx_export import SURFACE_VALIDATION_GPX, export_surface_validation_gpx
from surface_types import RiderCategory, report_group_for_rider

# Warn when more than this percentage of the route is classified as Unknown.
UNKNOWN_WARNING_THRESHOLD_PCT = 10.0

SURFACE_SEGMENTS_CSV = "surface_segments.csv"
UNKNOWN_SEGMENTS_CSV = "unknown_segments.csv"

_SURFACE_SEGMENTS_HEADER = (
    "Start km",
    "End km",
    "Length (km)",
    "Surface",
    "Rider category",
    "Rider subcategory",
    "Surface source",
    "Surface confidence",
    "Original OSM surface tag",
    "OSM highway",
    "OSM tracktype",
    "OSM smoothness",
    "Way ID",
)

_UNKNOWN_SEGMENTS_HEADER = _SURFACE_SEGMENTS_HEADER + (
    "Start Lat",
    "Start Lon",
    "End Lat",
    "End Lon",
)


def _segment_row(segment: SurfaceSegment) -> dict[str, str | float | int]:
    """Build a flat CSV row from one surface segment."""
    resolved = segment.resolved_points
    report_surface = report_group_for_rider(resolved.rider_category).value
    return {
        "Start km": round(segment.start_km, 2),
        "End km": round(segment.end_km, 2),
        "Length (km)": round(segment.length_km, 2),
        "Surface": report_surface,
        "Rider category": resolved.rider_category.value,
        "Rider subcategory": resolved.rider_subcategory,
        "Surface source": resolved.surface_source.value,
        "Surface confidence": round(segment.avg_surface_confidence, 3),
        "Original OSM surface tag": segment.osm_surface or "",
        "OSM highway": segment.tags.get("highway", ""),
        "OSM tracktype": segment.tags.get("tracktype", ""),
        "OSM smoothness": segment.tags.get("smoothness", ""),
        "Way ID": segment.way_id if segment.way_id is not None else "",
    }


def export_surface_segments_csv(dataset: SurfaceDataset, output_path: Path) -> None:
    """Export every detected surface segment for manual validation."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(_SURFACE_SEGMENTS_HEADER))
        writer.writeheader()
        for segment in dataset.segments:
            writer.writerow(_segment_row(segment))


def export_unknown_segments_csv(dataset: SurfaceDataset, output_path: Path) -> None:
    """Export every segment classified as Unknown for manual review."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(_UNKNOWN_SEGMENTS_HEADER))
        writer.writeheader()

        for segment in dataset.segments:
            if segment.resolved_points.rider_category != RiderCategory.UNKNOWN:
                continue

            row = _segment_row(segment)
            row["Start Lat"] = round(segment.start_lat, 5)
            row["Start Lon"] = round(segment.start_lon, 5)
            row["End Lat"] = round(segment.end_lat, 5)
            row["End Lon"] = round(segment.end_lon, 5)
            writer.writerow(row)


def print_top_osm_surface_values(dataset: SurfaceDataset, limit: int = 20) -> None:
    """Print the most common raw OSM surface tag values found along the route."""
    counts: Counter[str] = Counter()

    for point in dataset.points:
        label = point.osm_surface if point.osm_surface is not None else "(no tag)"
        counts[label] += 1

    print()
    print(f"Top {limit} OSM surface values (GPX point counts):")

    if not counts:
        print("None")
        return

    top_label_width = max(len(label) for label, _ in counts.most_common(limit))

    for label, count in counts.most_common(limit):
        dots = "." * max(1, top_label_width - len(label) + 2)
        print(f"{label} {dots} {count}")


def print_unknown_warning(dataset: SurfaceDataset, total_distance_km: float) -> None:
    """Print a warning when too much of the route is classified as Unknown."""
    unknown_pct = dataset.summary.unknown_pct(total_distance_km)

    if unknown_pct > UNKNOWN_WARNING_THRESHOLD_PCT:
        print()
        print(
            f"WARNING: {unknown_pct:.0f}% of the route is Unknown "
            f"(threshold: {UNKNOWN_WARNING_THRESHOLD_PCT:.0f}%). "
            "Review unknown_segments.csv and consider using --refresh-osm."
        )


def run_surface_validation(
    track: list[TrackPoint],
    dataset: SurfaceDataset,
    total_distance_km: float,
    output_dir: Path,
) -> None:
    """Run all surface validation exports and diagnostics."""
    export_surface_segments_csv(dataset, output_dir / SURFACE_SEGMENTS_CSV)
    export_unknown_segments_csv(dataset, output_dir / UNKNOWN_SEGMENTS_CSV)
    export_surface_validation_gpx(track, dataset, output_dir / SURFACE_VALIDATION_GPX)

    print()
    print("Surface validation exports:")
    print(f"  {output_dir / SURFACE_SEGMENTS_CSV}")
    print(f"  {output_dir / UNKNOWN_SEGMENTS_CSV}")
    print(f"  {output_dir / SURFACE_VALIDATION_GPX}")

    print_top_osm_surface_values(dataset)
    print_unknown_warning(dataset, total_distance_km)
