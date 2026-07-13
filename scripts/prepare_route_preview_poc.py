#!/usr/bin/env python3
"""Prepare route preview segment JSON for a race."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def prepare_route_preview_segment(race_id: str, output_path: Path | None = None) -> Path:
    roadbook_path = PROJECT_ROOT / f"data/races/{race_id}/analysis/latest.json"
    race_path = PROJECT_ROOT / f"data/races/{race_id}/race.json"
    if not roadbook_path.is_file():
        raise FileNotFoundError(f"Roadbook not found for race {race_id}. Analyze the race first.")
    if not race_path.is_file():
        raise FileNotFoundError(f"Race manifest not found for race {race_id}.")

    roadbook = json.loads(roadbook_path.read_text(encoding="utf-8"))
    race = json.loads(race_path.read_text(encoding="utf-8"))

    climbs = sorted(roadbook["climbs"], key=lambda row: -row["elevation_gain_m"])
    if not climbs:
        raise ValueError("Roadbook does not contain any climbs for route preview.")
    climb = climbs[0]

    buffer_km = 12.0
    start_km = max(0.0, climb["start_km"] - buffer_km)
    end_km = climb["end_km"] + 4.0

    track = [
        {
            "lat": point["lat"],
            "lon": point["lon"],
            "km": point["km"],
            "ele_m": point["ele_m"],
        }
        for point in roadbook["route"]["track_points"]
        if start_km <= point["km"] <= end_km and point["ele_m"] is not None
    ]
    if len(track) < 2:
        raise ValueError("Not enough track points in preview segment.")

    verified_stops = race.get("preparation", {}).get("verified_stops", {})
    last_verified_water: dict | None = None
    for zone in sorted(roadbook["resupply_zones"], key=lambda row: row["distance_along_km"]):
        if zone["distance_along_km"] >= climb["start_km"]:
            break
        zone_key = str(zone["zone_id"])
        record = verified_stops.get(zone_key)
        if not record or record.get("status") != "verified":
            continue
        water = next((cat for cat in zone["categories"] if cat["key"] == "water"), None)
        if not water or not water.get("primary"):
            continue
        poi = water["primary"]
        last_verified_water = {
            "zone_id": zone["zone_id"],
            "hub_name": zone["name"],
            "km": round(zone["distance_along_km"]),
            "poi_name": poi.get("name") or poi.get("brand") or "Drinking water",
        }

    climb_name = climb.get("nickname") or climb.get("suggested_name") or climb["id"]
    payload = {
        "race_id": race_id,
        "race_name": race["meta"]["name"],
        "climb": {
            "id": climb["id"],
            "name": climb_name,
            "start_km": climb["start_km"],
            "end_km": climb["end_km"],
            "length_km": round(climb["length_km"], 1),
            "elevation_gain_m": climb["elevation_gain_m"],
            "avg_gradient_pct": round(climb["avg_gradient_pct"], 1),
        },
        "overlay": {
            "title": "Hardest climb",
            "name": climb_name,
            "stats_lines": [
                f"{climb['length_km']:.1f} km",
                f"+{climb['elevation_gain_m']} m",
                f"{climb['avg_gradient_pct']:.1f}%",
            ],
            "last_verified_water": last_verified_water,
        },
        "track": track,
    }

    if output_path is None:
        output_path = PROJECT_ROOT / f"data/races/{race_id}/previews/segment.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare route preview segment JSON.")
    parser.add_argument(
        "race_id",
        nargs="?",
        default="d836e1d9-1fa9-49ea-8476-694c6c00d090",
        help="Race UUID",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional output path (defaults to data/races/{race_id}/previews/segment.json)",
    )
    args = parser.parse_args()
    output = prepare_route_preview_segment(args.race_id, args.output)
    print(output)


if __name__ == "__main__":
    main()
