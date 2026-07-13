"""Reduce OSM segment count by merging consecutive spans on the same way."""

from __future__ import annotations

from surface_matcher import OsmWaySegment


def simplify_osm_segments(segments: list[OsmWaySegment]) -> list[OsmWaySegment]:
    """
    Merge consecutive micro-segments that belong to the same OSM way.

    Chains segments where the previous end equals the next start (within ~1 m).
    Preserves tags and way_id; reduces index size in dense OSM areas.
    """
    if not segments:
        return []

    merged: list[OsmWaySegment] = []
    current = segments[0]

    for segment in segments[1:]:
        if (
            segment.way_id == current.way_id
            and segment.tags == current.tags
            and _points_close(current.end_lat, current.end_lon, segment.start_lat, segment.start_lon)
        ):
            current = OsmWaySegment(
                way_id=current.way_id,
                tags=current.tags,
                start_lat=current.start_lat,
                start_lon=current.start_lon,
                end_lat=segment.end_lat,
                end_lon=segment.end_lon,
            )
            continue

        merged.append(current)
        current = segment

    merged.append(current)
    return merged


def _points_close(lat1: float, lon1: float, lat2: float, lon2: float) -> bool:
    return abs(lat1 - lat2) < 1e-5 and abs(lon1 - lon2) < 1e-5
