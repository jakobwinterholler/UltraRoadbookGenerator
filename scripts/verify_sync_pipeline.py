#!/usr/bin/env python3
"""End-to-end cloud sync verification against live Supabase."""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx", file=sys.stderr)
    raise SystemExit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

from companion_bundle import build_companion_bundle

DEFAULT_USER_ID = "641089b9-a9fc-43d4-abb6-c26e030aa732"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def _minimal_roadbook(name: str) -> dict:
    return {
        "summary": {
            "route_name": name,
            "distance_km": 42.0,
            "elevation_gain_m": 900.0,
        },
        "route": {
            "track_points": [
                {"lat": 46.0, "lon": 7.0, "ele_m": 500},
                {"lat": 46.1, "lon": 7.1, "ele_m": 600},
            ],
        },
        "resupply_zones": [],
    }


def push_test_race(url: str, key: str, user_id: str, race_id: str, name: str) -> int:
    roadbook = _minimal_roadbook(name)
    bundle = build_companion_bundle(race_id, roadbook, {}, revision=1)
    revision = int(bundle["revision"])
    base_path = f"{user_id}/{race_id}"

    for filename, payload, content_type in (
        ("analysis.json", json.dumps(roadbook, separators=(",", ":")).encode(), "application/json"),
        ("companion-bundle.json", json.dumps(bundle, separators=(",", ":")).encode(), "application/json"),
    ):
        storage_url = f"{url}/storage/v1/object/race-assets/{base_path}/{filename}"
        response = httpx.post(
            storage_url,
            content=payload,
            headers={**_headers(key), "Content-Type": content_type, "x-upsert": "true"},
            timeout=60.0,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Storage upload failed for {filename}: {response.text}")

    row = {
        "id": race_id,
        "user_id": user_id,
        "name": name,
        "distance_km": 42.0,
        "elevation_gain_m": 900.0,
        "preparation": {},
        "companion_revision": revision,
        "has_bundle": True,
        "analyzed_at": _utc_now(),
        "updated_at": _utc_now(),
        "deleted_at": None,
    }
    response = httpx.post(
        f"{url}/rest/v1/races",
        headers={**_headers(key), "Prefer": "resolution=merge-duplicates,return=representation"},
        json=row,
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Race upsert failed: {response.text}")
    saved = response.json()[0]
    return int(saved.get("companion_revision", revision))


def list_user_races(url: str, key: str, user_id: str) -> list[dict]:
    response = httpx.get(
        f"{url}/rest/v1/races",
        params={
            "user_id": f"eq.{user_id}",
            "deleted_at": "is.null",
            "select": "id,name,companion_revision,has_bundle,updated_at",
            "order": "updated_at.desc",
        },
        headers=_headers(key),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Race list failed: {response.text}")
    return response.json()


def verify_bundle(url: str, key: str, user_id: str, race_id: str) -> None:
    path = f"{user_id}/{race_id}/companion-bundle.json"
    response = httpx.get(
        f"{url}/storage/v1/object/race-assets/{path}",
        headers=_headers(key),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Bundle download failed: {response.text}")
    bundle = response.json()
    if bundle.get("race", {}).get("id") != race_id:
        raise RuntimeError("Bundle race id mismatch.")


def soft_delete_race(url: str, key: str, user_id: str, race_id: str) -> None:
    response = httpx.patch(
        f"{url}/rest/v1/races",
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}"},
        headers=_headers(key),
        json={"deleted_at": _utc_now()},
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Soft delete failed: {response.text}")


def main() -> int:
    if load_dotenv is not None:
        load_dotenv(PROJECT_ROOT / ".env")
        load_dotenv(PROJECT_ROOT / ".env.local")

    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    user_id = os.getenv("SYNC_TEST_USER_ID", DEFAULT_USER_ID)

    if not url or not key:
        print("Missing SUPABASE_URL or service role key.", file=sys.stderr)
        return 1

    race_id = str(uuid.uuid4())
    name = f"Sync pipeline test {datetime.now().strftime('%H:%M:%S')}"
    print(f"Creating test race {race_id} ({name})…")

    revision = push_test_race(url, key, user_id, race_id, name)
    print(f"✓ Uploaded bundle revision {revision}")

    races = list_user_races(url, key, user_id)
    match = next((race for race in races if race["id"] == race_id), None)
    if match is None:
        raise RuntimeError("Race missing from cloud list after upload.")
    if not match.get("has_bundle"):
        raise RuntimeError("Race has_bundle=false after upload.")
    print(f"✓ Race visible in cloud list (revision {match.get('companion_revision')})")

    verify_bundle(url, key, user_id, race_id)
    print("✓ companion-bundle.json readable from storage")

    soft_delete_race(url, key, user_id, race_id)
    races_after = list_user_races(url, key, user_id)
    if any(race["id"] == race_id for race in races_after):
        raise RuntimeError("Soft-deleted race still visible in active list.")
    print("✓ Soft delete removes race from active cloud list")

    print("Sync pipeline verification passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
