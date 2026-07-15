"""Tests for GPS GPX export — original track must remain unchanged."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from race_gpx_export import (
    GpsGpxExportOptions,
    GpxTrackModifiedError,
    export_race_gpx_for_gps,
    fingerprint_gpx_bytes,
)
from race_project import race_store

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "races"

RACES = {
    "capitals": "d836e1d9-1fa9-49ea-8476-694c6c00d090",
    "collserola": "b7a1c487-80c6-477c-87ae-ec9dd32b900c",
    "debug_flow": "5154964a-629e-4143-b318-31b2e7106465",
}


def _load_verified_stops(race_id: str) -> dict:
    race = race_store.get_race(race_id)
    return {key: record.to_dict() for key, record in race.preparation.verified_stops.items()}


def _export_to_tmp(race_id: str, options: GpsGpxExportOptions | None = None) -> tuple[bytes, bytes, dict]:
    gpx_path = race_store.get_gpx_path(race_id)
    roadbook = race_store.load_analysis(race_id)
    assert roadbook is not None
    original = gpx_path.read_bytes()
    output_path = race_store.export_path(race_id, "_test_gps_export.gpx")
    summary = export_race_gpx_for_gps(
        original_gpx_path=gpx_path,
        roadbook=roadbook,
        verified_stops=_load_verified_stops(race_id),
        output_path=output_path,
        options=options,
    )
    exported = output_path.read_bytes()
    output_path.unlink(missing_ok=True)
    return original, exported, summary


@pytest.mark.parametrize("race_key", RACES.keys())
def test_track_geometry_unchanged(race_key: str, tmp_path: Path) -> None:
    race_id = RACES[race_key]
    original, exported, summary = _export_to_tmp(
        race_id,
        GpsGpxExportOptions(device_profile="coros"),
    )
    before = fingerprint_gpx_bytes(original)
    after = fingerprint_gpx_bytes(exported)
    assert before.track_point_count == after.track_point_count
    assert before.geometry_checksum == after.geometry_checksum
    assert before.track_bytes_checksum == after.track_bytes_checksum
    assert summary["track_point_count"] == before.track_point_count


def test_capitals_large_route_preserves_all_track_points() -> None:
    race_id = RACES["capitals"]
    original, exported, summary = _export_to_tmp(race_id)
    before = fingerprint_gpx_bytes(original)
    assert before.track_point_count > 1000
    assert summary["waypoint_count"] >= 1
    assert before.track_point_count == fingerprint_gpx_bytes(exported).track_point_count


def test_debug_flow_no_verified_still_preserves_track() -> None:
    race_id = RACES["debug_flow"]
    original, exported, summary = _export_to_tmp(race_id)
    assert summary["waypoint_count"] == 0
    assert fingerprint_gpx_bytes(original).geometry_checksum == fingerprint_gpx_bytes(exported).geometry_checksum


def test_collserola_adds_verified_waypoints_in_order() -> None:
    race_id = RACES["collserola"]
    _, exported, summary = _export_to_tmp(race_id, GpsGpxExportOptions(device_profile="coros"))
    assert summary["waypoint_count"] >= 1
    names = [
        match.decode("utf-8")
        for match in __import__("re").findall(rb"<name>([^<]+)</name>", exported)
        if b"KM" in match
    ]
    assert names == sorted(names, key=lambda value: int(value.split("KM")[-1]))


def test_only_waypoint_section_differs() -> None:
    race_id = RACES["collserola"]
    original, exported, _summary = _export_to_tmp(race_id)
    assert exported.startswith(original[: original.lower().find(b"<gpx")])
    assert b"</gpx>" in exported
    assert len(exported) >= len(original)
