#!/usr/bin/env python3
"""Benchmark analysis pipeline stages for long routes."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC_DIR))

from pipeline import OSM_CACHE_DIR, analyze_gpx_file  # noqa: E402
from pipeline_profiler import PipelineProfiler  # noqa: E402


def _format_row(label: str, duration_s: float, percent: float) -> str:
    return f"{label:<28} {duration_s:>8.1f}s  ({percent:>5.1f}%)"


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark UltraRoadbookGenerator analysis pipeline")
    parser.add_argument("gpx", type=Path, help="Path to GPX file")
    parser.add_argument(
        "--refresh-osm",
        action="store_true",
        help="Ignore cached OSM data (cold Overpass download)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON summary",
    )
    args = parser.parse_args()

    if not args.gpx.is_file():
        print(f"GPX not found: {args.gpx}", file=sys.stderr)
        return 1

    started = time.perf_counter()
    artifacts = analyze_gpx_file(args.gpx, refresh_osm=args.refresh_osm)
    total_s = time.perf_counter() - started

    report = artifacts.roadbook.performance_report
    summary = artifacts.roadbook.performance_summary

    if args.json:
        payload = {
            "gpx": str(args.gpx),
            "total_s": round(total_s, 1),
            "stages": [row.__dict__ for row in report],
            "summary": summary.__dict__ if summary is not None else None,
            "cache_dir": str(OSM_CACHE_DIR),
        }
        print(json.dumps(payload, indent=2))
        return 0

    print(f"\nBenchmark: {args.gpx.name}")
    print(f"Route distance: {artifacts.roadbook.summary.distance_km:.1f} km")
    if summary is not None:
        print(f"Cache mode: {summary.cache_mode}")
        print(f"Memory peak: {summary.memory_peak_mb:.1f} MB")
        print(
            f"Targets: cold ≤ {summary.target_cold_s:.0f}s, warm ≤ {summary.target_warm_s:.0f}s",
        )
        if summary.cache_mode in {"warm", "hot"}:
            print(
                f"Warm target: {'PASS' if summary.meets_warm_target else 'MISS'} ({total_s:.1f}s)",
            )
        if summary.cache_mode == "cold":
            print(
                f"Cold target: {'PASS' if summary.meets_cold_target else 'MISS'} ({total_s:.1f}s)",
            )
    print()
    print("Stage breakdown:")
    for row in report:
        print(_format_row(row.label, row.duration_s, row.percent))
    print(_format_row("Wall clock total", total_s, 100.0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
