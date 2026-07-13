"""Colored GPX export for visual surface-validation debugging."""

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from gpx_parser import TrackPoint
from surface_detector import SurfaceDataset, SurfaceSegment
from surface_types import ReportGroup, RiderCategory, report_group_for_rider

GPX_NS = "http://www.topografix.com/GPX/1/1"
GPXX_NS = "http://www.garmin.com/xmlschemas/GpxExtensions/v3"
GPX_STYLE_NS = "http://www.topografix.com/GPX/gpx_style/1"

SURFACE_VALIDATION_GPX = "surface_validation.gpx"

# Register namespaces so exported XML uses standard GPX prefixes.
ET.register_namespace("", GPX_NS)
ET.register_namespace("gpxx", GPXX_NS)
ET.register_namespace("gpx_style", GPX_STYLE_NS)


@dataclass(frozen=True)
class TrackColor:
    """Color definitions for one reporting surface group."""

    hex_rgb: str
    garmin_display_color: str


# Asphalt=blue, Gravel=brown, Unknown=red.
# Garmin has no brown; DarkYellow is the closest built-in option for gravel.
SURFACE_TRACK_COLORS: dict[ReportGroup, TrackColor] = {
    ReportGroup.ASPHALT: TrackColor(hex_rgb="0000FF", garmin_display_color="Blue"),
    ReportGroup.GRAVEL: TrackColor(hex_rgb="8B4513", garmin_display_color="DarkYellow"),
    ReportGroup.UNKNOWN: TrackColor(hex_rgb="FF0000", garmin_display_color="Red"),
}

RIDER_TRACK_COLORS: dict[RiderCategory, TrackColor] = {
    RiderCategory.ROAD: TrackColor(hex_rgb="2563EB", garmin_display_color="Blue"),
    RiderCategory.GRAVEL: TrackColor(hex_rgb="854D0E", garmin_display_color="DarkYellow"),
    RiderCategory.TRAIL: TrackColor(hex_rgb="16A34A", garmin_display_color="Green"),
    RiderCategory.UNKNOWN: TrackColor(hex_rgb="EF4444", garmin_display_color="Red"),
}


def _gpx_tag(name: str) -> str:
    return f"{{{GPX_NS}}}{name}"


def _gpxx_tag(name: str) -> str:
    return f"{{{GPXX_NS}}}{name}"


def _gpx_style_tag(name: str) -> str:
    return f"{{{GPX_STYLE_NS}}}{name}"


def _track_points_for_segment(
    track: list[TrackPoint],
    segment: SurfaceSegment,
) -> list[TrackPoint]:
    """Return original route points that fall within one surface segment."""
    return [point for point in track if segment.start_km <= point.distance_km <= segment.end_km]


def _append_track_extensions(track_element: ET.Element, track_color: TrackColor) -> None:
    """
    Add color extensions for GPX Studio, RideWithGPS, and Garmin Connect.

    Uses gpx_style hex colors for web/desktop viewers and Garmin DisplayColor
    for Garmin Connect where only named colors are supported.
    """
    extensions = ET.SubElement(track_element, _gpx_tag("extensions"))

    line = ET.SubElement(extensions, _gpx_style_tag("line"))
    color_element = ET.SubElement(line, _gpx_style_tag("color"))
    color_element.text = track_color.hex_rgb

    width_element = ET.SubElement(line, _gpx_style_tag("width"))
    width_element.text = "5"

    track_extension = ET.SubElement(extensions, _gpxx_tag("TrackExtension"))
    display_color = ET.SubElement(track_extension, _gpxx_tag("DisplayColor"))
    display_color.text = track_color.garmin_display_color


def _append_track_segment(
    root: ET.Element,
    segment: SurfaceSegment,
    points: list[TrackPoint],
) -> None:
    """Append one colored track for a surface segment."""
    resolved = segment.resolved_points
    report_group = report_group_for_rider(resolved.rider_category)
    track_color = RIDER_TRACK_COLORS[resolved.rider_category]
    surface_label = segment.osm_surface or resolved.rider_subcategory

    track_element = ET.SubElement(root, _gpx_tag("trk"))

    name_element = ET.SubElement(track_element, _gpx_tag("name"))
    name_element.text = (
        f"{report_group.value} "
        f"({segment.start_km:.2f}-{segment.end_km:.2f} km, {surface_label})"
    )

    type_element = ET.SubElement(track_element, _gpx_tag("type"))
    type_element.text = report_group.value

    _append_track_extensions(track_element, track_color)

    segment_element = ET.SubElement(track_element, _gpx_tag("trkseg"))
    for point in points:
        point_element = ET.SubElement(segment_element, _gpx_tag("trkpt"))
        point_element.set("lat", f"{point.lat:.8f}")
        point_element.set("lon", f"{point.lon:.8f}")

        if point.elevation_m is not None:
            elevation_element = ET.SubElement(point_element, _gpx_tag("ele"))
            elevation_element.text = f"{point.elevation_m:.1f}"


def export_surface_validation_gpx(
    track: list[TrackPoint],
    dataset: SurfaceDataset,
    output_path: Path,
) -> None:
    """
    Export the route as colored GPX track segments for visual inspection.

    Each detected surface segment becomes its own track with color extensions.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    root = ET.Element(
        _gpx_tag("gpx"),
        {
            "version": "1.1",
            "creator": "UltraRoadbookGenerator",
        },
    )

    metadata = ET.SubElement(root, _gpx_tag("metadata"))
    metadata_name = ET.SubElement(metadata, _gpx_tag("name"))
    metadata_name.text = "Surface Validation"
    metadata_desc = ET.SubElement(metadata, _gpx_tag("desc"))
    metadata_desc.text = "Road=blue, Gravel=brown, Trail=green, Unknown=red"

    for segment in dataset.segments:
        points = _track_points_for_segment(track, segment)
        if len(points) < 2:
            continue
        _append_track_segment(root, segment, points)

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="UTF-8", xml_declaration=True)
