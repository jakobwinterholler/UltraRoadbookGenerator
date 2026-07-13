"""Entry point for UltraRoadbookGenerator."""

import argparse
from pathlib import Path

from climb_detector import Climb, detect_climbs
from excel_export import export_roadbook
from gradient_analysis import analyze_all_climbs
from gpx_parser import parse_gpx, parse_gpx_track
from surface_detector import (
    detect_surfaces,
    print_surface_runtime_report,
    print_surface_summary,
    print_unknown_segments,
)
from surface_validation import run_surface_validation

# Default paths relative to project root.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GPX_PATH = PROJECT_ROOT / "input" / "route.gpx"
OUTPUT_DIR = PROJECT_ROOT / "output"
ROADBOOK_PATH = OUTPUT_DIR / "Roadbook.xlsx"
OSM_CACHE_DIR = PROJECT_ROOT / "cache" / "osm"


def print_climbs_table(climbs: list[Climb]) -> None:
    """Print detected climbs as a fixed-width, single-line table."""
    # Fixed column widths (chosen to fit headers and typical values on one line).
    width_id = 4
    width_start = 9
    width_end = 8
    width_length = 10
    width_gain = 7
    width_avg = 6
    gap = "  "

    separator_width = (
        width_id
        + len(gap)
        + width_start
        + len(gap)
        + width_end
        + len(gap)
        + width_length
        + len(gap)
        + width_gain
        + len(gap)
        + width_avg
    )

    header = (
        f"{'ID'.ljust(width_id)}{gap}"
        f"{'Start(km)'.ljust(width_start)}{gap}"
        f"{'End(km)'.ljust(width_end)}{gap}"
        f"{'Length(km)'.ljust(width_length)}{gap}"
        f"{'Gain(m)'.ljust(width_gain)}{gap}"
        f"{'Avg(%)'.ljust(width_avg)}"
    )

    print(header)
    print("-" * separator_width)

    for climb in climbs:
        row = (
            f"{climb.climb_id.ljust(width_id)}{gap}"
            f"{climb.start_km:>{width_start}.2f}{gap}"
            f"{climb.end_km:>{width_end}.2f}{gap}"
            f"{climb.length_km:>{width_length}.2f}{gap}"
            f"{round(climb.elevation_gain_m):>{width_gain}d}{gap}"
            f"{climb.avg_gradient_pct:>{width_avg}.1f}"
        )
        print(row)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UltraRoadbookGenerator")
    parser.add_argument(
        "--refresh-osm",
        action="store_true",
        help="Ignore cached OSM data and download fresh data from Overpass.",
    )
    return parser.parse_args()


def main() -> None:
    """Parse the route GPX file, detect climbs, and print results."""
    args = _parse_args()

    stats = parse_gpx(GPX_PATH)
    track = parse_gpx_track(GPX_PATH)
    surface_dataset = detect_surfaces(
        track,
        GPX_PATH,
        OSM_CACHE_DIR,
        refresh_osm=args.refresh_osm,
    )
    climbs = detect_climbs(track)
    climbs_with_gradients = analyze_all_climbs(track, climbs)

    print(f"Route: {GPX_PATH.name}")
    print(f"Total distance: {stats.distance_km:.2f} km")
    print(f"Total elevation gain: {round(stats.elevation_gain_m)} m")
    print(f"Number of track points: {stats.track_point_count}")
    print()
    print_surface_summary(surface_dataset, stats.distance_km)
    print_unknown_segments(surface_dataset)
    print_surface_runtime_report(surface_dataset)
    run_surface_validation(track, surface_dataset, stats.distance_km, OUTPUT_DIR)
    print()
    print(f"Detected climbs: {len(climbs)}")
    print()

    if climbs:
        print_climbs_table(climbs)
    else:
        print("No climbs detected.")

    export_roadbook(climbs_with_gradients, ROADBOOK_PATH)
    print()
    print(f"Excel roadbook written to: {ROADBOOK_PATH}")


if __name__ == "__main__":
    main()
