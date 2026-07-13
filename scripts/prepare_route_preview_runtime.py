#!/usr/bin/env python3
"""Prepare multi-scene route preview runtime JSON for a race."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
from preview_versions import (  # noqa: E402
    CAMERA_VERSION,
    PREVIEW_PIPELINE_VERSION,
    RUNTIME_VERSION,
    STORY_VERSION,
)

SCREEN_TIME = {
    "title": 8,
    "overview": 50,
    "start": 14,
    "finish": 14,
    "climb": 42,
    "town": 22,
    "verified_stop": 22,
    "unsupported": 28,
    "remote": 28,
    "scenery": 24,
}

TRANSITION_AFTER = {
    "title": 1,
    "overview": 2,
    "start": 2,
    "finish": 0,
    "climb": 2,
    "town": 2,
    "verified_stop": 2,
    "unsupported": 2,
    "remote": 2,
    "scenery": 2,
}



def _track_slice(
    track_points: list[dict],
    start_km: float,
    end_km: float,
) -> list[dict]:
    return [
        {
            "lat": point["lat"],
            "lon": point["lon"],
            "km": point["km"],
            "ele_m": point["ele_m"],
        }
        for point in track_points
        if start_km <= point["km"] <= end_km and point.get("ele_m") is not None
    ]


def _downsample_track(track: list[dict], max_points: int = 2400) -> list[dict]:
    if len(track) <= max_points:
        return track
    step = max(1, len(track) // max_points)
    sampled = track[::step]
    if sampled[-1]["km"] != track[-1]["km"]:
        sampled.append(track[-1])
    return sampled


def _last_verified_water(
    zones: list[dict],
    verified_stops: dict,
    before_km: float,
) -> dict | None:
    last: dict | None = None
    for zone in sorted(zones, key=lambda row: row["distance_along_km"]):
        if zone["distance_along_km"] >= before_km:
            break
        record = verified_stops.get(str(zone["zone_id"]))
        if not record or record.get("status") != "verified":
            continue
        water = next((cat for cat in zone["categories"] if cat["key"] == "water"), None)
        if not water or not water.get("primary"):
            continue
        poi = water["primary"]
        last = {
            "zone_id": zone["zone_id"],
            "hub_name": zone["name"],
            "km": round(zone["distance_along_km"]),
            "poi_name": poi.get("name") or poi.get("brand") or "Drinking water",
        }
    return last


def _select_unsupported_section(zones: list[dict], route: dict, total_km: float) -> dict | None:
    # Simple MVP: longest gap between resupply zones with few POIs.
    sorted_zones = sorted(zones, key=lambda row: row["distance_along_km"])
    best: dict | None = None
    best_score = 0.0
    for left, right in zip(sorted_zones, sorted_zones[1:]):
        gap_km = right["distance_along_km"] - left["distance_along_km"]
        if gap_km < 35:
            continue
        score = gap_km + max(0, 80 - min(left["poi_count"], right["poi_count"]))
        if score > best_score:
            best_score = score
            best = {
                "start_km": left["distance_along_km"] + 2,
                "end_km": right["distance_along_km"] - 2,
                "label": f"Unsupported · {gap_km:.0f} km gap",
            }
    if best:
        return best
    mid = total_km * 0.55
    return {"start_km": mid - 18, "end_km": mid + 18, "label": "Unsupported section"}


def _select_verified_stop(zones: list[dict], verified_stops: dict) -> dict | None:
    candidates = []
    for zone in zones:
        record = verified_stops.get(str(zone["zone_id"]))
        if not record or record.get("status") != "verified":
            continue
        candidates.append(zone)
    if not candidates:
        return None
    candidates.sort(key=lambda row: (-row["poi_count"], row["distance_along_km"]))
    zone = candidates[0]
    return {
        "zone_id": zone["zone_id"],
        "name": zone["name"],
        "km": zone["distance_along_km"],
        "poi_count": zone["poi_count"],
    }


def prepare_route_preview_runtime(race_id: str, output_path: Path | None = None) -> Path:
    roadbook_path = PROJECT_ROOT / f"data/races/{race_id}/analysis/latest.json"
    race_path = PROJECT_ROOT / f"data/races/{race_id}/race.json"
    if not roadbook_path.is_file():
        raise FileNotFoundError(f"Roadbook not found for race {race_id}. Analyze the race first.")
    if not race_path.is_file():
        raise FileNotFoundError(f"Race manifest not found for race {race_id}.")

    roadbook = json.loads(roadbook_path.read_text(encoding="utf-8"))
    race = json.loads(race_path.read_text(encoding="utf-8"))
    verified_stops = race.get("preparation", {}).get("verified_stops", {})

    climbs = sorted(roadbook["climbs"], key=lambda row: -row["elevation_gain_m"])
    if not climbs:
        raise ValueError("Roadbook does not contain any climbs for route preview.")
    climb = climbs[0]
    climb_name = climb.get("nickname") or climb.get("suggested_name") or climb["id"]

    total_km = roadbook["summary"]["distance_km"]
    route_name = roadbook["summary"]["route_name"]
    race_name = race["meta"]["name"]
    track_points = roadbook["route"]["track_points"]
    zones = roadbook["resupply_zones"]

    unsupported = _select_unsupported_section(zones, roadbook["route"], total_km)
    verified = _select_verified_stop(zones, verified_stops)
    last_water = _last_verified_water(zones, verified_stops, climb["start_km"])

    scenes: list[dict] = []
    order = 1

    scenes.append(
        {
            "id": "title",
            "order": order,
            "type": "title",
            "title": race_name,
            "description": f"{total_km:.0f} km · +{round(roadbook['summary']['elevation_gain_m'])} m climbing",
            "whyChosen": "Sets scale as the ride begins.",
            "learningGoal": f"{total_km:.0f} km ahead — get a feel for the scale.",
            "screenTimeS": SCREEN_TIME["title"],
            "transitionAfterS": TRANSITION_AFTER["title"],
            "kmRange": {"startKm": 0, "endKm": min(25.0, total_km * 0.03)},
            "priority": 5,
            "overlayMode": "breath",
            "overlay": {
                "eyebrow": "Route Preview",
                "name": race_name,
                "statsLines": [
                    f"{total_km:.0f} km",
                    f"+{round(roadbook['summary']['elevation_gain_m'])} m",
                    f"{roadbook['summary']['climb_count']} climbs",
                ],
            },
        }
    )
    order += 1

    scenes.append(
        {
            "id": "overview",
            "order": order,
            "type": "overview",
            "title": "Route overview",
            "description": (
                f"{roadbook['summary']['climb_count']} climbs · "
                f"{round(roadbook['summary']['gravel_pct'])}% gravel · "
                f"{round(roadbook['summary']['road_pct'])}% paved"
            ),
            "whyChosen": "See how the route flows across the landscape.",
            "learningGoal": "A flowing pass along the full course — geography, distance, terrain character.",
            "screenTimeS": SCREEN_TIME["overview"],
            "transitionAfterS": TRANSITION_AFTER["overview"],
            "kmRange": {"startKm": 0, "endKm": total_km},
            "priority": 4,
            "overlayMode": "breath",
            "overlay": {
                "eyebrow": "Overview",
                "name": route_name,
                "statsLines": [
                    f"{total_km:.0f} km total",
                    f"{roadbook['summary']['climb_count']} key climbs",
                    f"{round(roadbook['summary']['gravel_pct'])}% gravel",
                ],
            },
        }
    )
    order += 1

    climb_buffer = 14.0
    scenes.append(
        {
            "id": f"climb-{climb['id']}",
            "order": order,
            "type": "climb",
            "title": "Hardest climb",
            "description": (
                f"{climb_name} · {climb['length_km']:.1f} km · "
                f"+{climb['elevation_gain_m']} m · {climb['avg_gradient_pct']:.1f}% avg"
            ),
            "whyChosen": "Signature climbing challenge — highest difficulty score among key climbs.",
            "learningGoal": (
                f"Riding through {climb_name} — "
                f"{climb['length_km']:.1f} km at {climb['avg_gradient_pct']:.1f}% average."
            ),
            "screenTimeS": SCREEN_TIME["climb"],
            "transitionAfterS": TRANSITION_AFTER["climb"],
            "kmRange": {
                "startKm": max(0.0, climb["start_km"] - climb_buffer),
                "endKm": climb["end_km"] + 4.0,
            },
            "priority": 5,
            "overlayMode": "climb",
            "overlay": {
                "eyebrow": "Hardest climb",
                "name": climb_name,
                "statsLines": [
                    f"{climb['length_km']:.1f} km",
                    f"+{climb['elevation_gain_m']} m",
                    f"{climb['avg_gradient_pct']:.1f}% avg",
                ],
                "waterLabel": "Last verified water",
                "waterValue": (
                    f"{last_water['poi_name']}, km {last_water['km']}"
                    if last_water
                    else "None verified before this climb"
                ),
            },
        }
    )
    order += 1

    if verified:
        scenes.append(
            {
                "id": f"verified-{verified['zone_id']}",
                "order": order,
                "type": "verified_stop",
                "title": "Verified stop",
                "description": f"{verified['name']} · km {round(verified['km'])}",
                "whyChosen": "A stop you chose to trust during planning.",
                "learningGoal": f"You verified {verified['name']} — a reliable anchor at km {round(verified['km'])}.",
                "screenTimeS": SCREEN_TIME["verified_stop"],
                "transitionAfterS": TRANSITION_AFTER["verified_stop"],
                "kmRange": {
                    "startKm": max(0.0, verified["km"] - 4.0),
                    "endKm": verified["km"] + 4.0,
                },
                "priority": 4,
                "overlayMode": "card",
                "overlay": {
                    "eyebrow": "Verified stop",
                    "name": verified["name"],
                    "statsLines": [
                        f"km {round(verified['km'])}",
                        f"{verified['poi_count']} nearby options",
                    ],
                    "narrative": "You verified this stop — refill here before harder sections ahead.",
                },
            }
        )
        order += 1

    if unsupported:
        scenes.append(
            {
                "id": "unsupported-gap",
                "order": order,
                "type": "unsupported",
                "title": "Unsupported section",
                "description": unsupported["label"],
                "whyChosen": "High-risk unsupported gap.",
                "learningGoal": f"Remote section — {unsupported['label']}. Plan your carries before entering.",
                "screenTimeS": SCREEN_TIME["unsupported"],
                "transitionAfterS": TRANSITION_AFTER["unsupported"],
                "kmRange": {
                    "startKm": max(0.0, unsupported["start_km"] - 3.0),
                    "endKm": min(total_km, unsupported["end_km"] + 3.0),
                },
                "priority": 4,
                "overlayMode": "card",
                "overlay": {
                    "eyebrow": "Unsupported",
                    "name": "Plan your carries",
                    "statsLines": [
                        f"km {round(unsupported['start_km'])}–{round(unsupported['end_km'])}",
                        unsupported["label"],
                    ],
                    "narrative": "Limited services on route — carry enough food and water through this gap.",
                },
            }
        )
        order += 1

    scenes.append(
        {
            "id": "finish",
            "order": order,
            "type": "finish",
            "title": "Finish",
            "description": f"The arrival at km {total_km:.0f}",
            "whyChosen": "Ride into the finish line.",
            "learningGoal": f"Approaching the finish — {total_km:.0f} km complete.",
            "screenTimeS": SCREEN_TIME["finish"],
            "transitionAfterS": TRANSITION_AFTER["finish"],
            "kmRange": {"startKm": max(0.0, total_km - 12), "endKm": total_km},
            "priority": 5,
            "overlayMode": "breath",
            "overlay": {
                "eyebrow": "Finish",
                "name": route_name,
                "statsLines": [f"{total_km:.0f} km complete"],
            },
        }
    )

    # Sparse route samples for camera interpolation along the full course.
    route_samples: list[dict] = []
    sample_count = 240
    for index in range(sample_count):
        target_km = (total_km * index) / max(1, sample_count - 1)
        nearest = min(track_points, key=lambda row: abs(row["km"] - target_km))
        if nearest.get("ele_m") is None:
            continue
        route_samples.append(
            {
                "lat": nearest["lat"],
                "lon": nearest["lon"],
                "km": nearest["km"],
                "ele_m": nearest["ele_m"],
            }
        )
    route_samples = _downsample_track(route_samples, max_points=240)

    # Build render track from story beats only — never the full route span.
    # Overview/title/finish use sparse anchors; climb/stop/unsupported use local corridors.
    track: list[dict] = []
    seen_km: set[float] = set()

    def add_track_slice(start_km: float, end_km: float) -> None:
        for point in _track_slice(track_points, start_km, end_km):
            key = round(point["km"], 2)
            if key in seen_km:
                continue
            seen_km.add(key)
            track.append(point)

    for scene in scenes:
        scene_type = scene["type"]
        if scene_type in {"title", "overview", "finish"}:
            continue
        start_km = max(0.0, scene["kmRange"]["startKm"] - 12.0)
        end_km = min(total_km, scene["kmRange"]["endKm"] + 12.0)
        add_track_slice(start_km, end_km)

    add_track_slice(0.0, min(12.0, total_km))
    add_track_slice(max(0.0, total_km - 12.0), total_km)

    track.sort(key=lambda row: row["km"])
    track = _downsample_track(track, max_points=1400)

    if len(track) < 2:
        raise ValueError("Not enough track points in route preview runtime.")

    timeline: list[dict] = []
    cursor = 0.0
    for scene in scenes:
        start_s = cursor
        end_s = start_s + scene["screenTimeS"]
        timeline.append(
            {
                "sceneId": scene["id"],
                "sceneOrder": scene["order"],
                "sceneType": scene["type"],
                "title": scene["title"],
                "startS": start_s,
                "endS": end_s,
                "transitionAfterS": scene["transitionAfterS"],
                "kmRange": scene["kmRange"],
            }
        )
        cursor = end_s + scene["transitionAfterS"]

    payload = {
        "version": 2,
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "storyVersion": STORY_VERSION,
            "runtimeVersion": RUNTIME_VERSION,
            "cameraVersion": CAMERA_VERSION,
            "pipelineVersion": PREVIEW_PIPELINE_VERSION,
        },
        "raceId": race_id,
        "raceName": race_name,
        "routeName": route_name,
        "distanceKm": total_km,
        "totalDurationS": cursor,
        "scenes": scenes,
        "timeline": timeline,
        "routeSamples": route_samples,
        "track": track,
        "featuredClimb": {
            "id": climb["id"],
            "name": climb_name,
            "startKm": climb["start_km"],
            "endKm": climb["end_km"],
            "lengthKm": round(climb["length_km"], 1),
            "elevationGainM": climb["elevation_gain_m"],
            "avgGradientPct": round(climb["avg_gradient_pct"], 1),
            "max250mPct": climb.get("max_250_m_pct"),
            "max500mPct": climb.get("max_500_m_pct"),
            "mentalNote": (
                f"Steepest 250 m at {climb['max_250_m_pct']:.1f}% — plan your effort for the middle."
                if climb.get("max_250_m_pct")
                else None
            ),
            "lastVerifiedWater": (
                {
                    "poiName": last_water["poi_name"],
                    "km": last_water["km"],
                    "hubName": last_water.get("hub_name"),
                }
                if last_water
                else None
            ),
        },
        "settings": {
            "fps": 24,
            "draft": {
                "width": 1280,
                "height": 720,
                "terrainSegments": 320,
                "routeTubeSegments": 320,
            },
            "final": {
                "width": 2560,
                "height": 1440,
                "terrainSegments": 480,
                "routeTubeSegments": 480,
            },
        },
    }

    if output_path is None:
        output_path = PROJECT_ROOT / f"data/races/{race_id}/previews/runtime.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Backward-compatible segment file for offline export tooling.
    segment_path = output_path.parent / "segment.json"
    segment_path.write_text(
        json.dumps(
            {
                "race_id": race_id,
                "race_name": race_name,
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
                    "last_verified_water": last_water,
                },
                "track": track,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare multi-scene route preview runtime JSON.")
    parser.add_argument("race_id", help="Race UUID")
    parser.add_argument("--output", type=Path, help="Optional output path")
    args = parser.parse_args()
    output = prepare_route_preview_runtime(args.race_id, args.output)
    print(output)


if __name__ == "__main__":
    main()
